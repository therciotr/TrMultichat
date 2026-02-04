import { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";
import moment from "moment";
const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
        setIsAuth(true);
      }
      return config;
    },
    (error) => {
      Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      if (
        (error?.response?.status === 401 || error?.response?.status === 403) &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        // 1) Prefer refreshToken (7d)
        try {
          const storedRefresh = localStorage.getItem("refreshToken");
          if (storedRefresh) {
            let refreshToken = storedRefresh;
            try {
              refreshToken = JSON.parse(storedRefresh);
            } catch (_) {}
            const { data } = await api.post("/auth/refresh", { refreshToken });
            if (data?.accessToken) {
              localStorage.setItem("token", JSON.stringify(data.accessToken));
              if (data.refreshToken) {
                localStorage.setItem("refreshToken", JSON.stringify(data.refreshToken));
              }
              api.defaults.headers.Authorization = `Bearer ${data.accessToken}`;
              return api(originalRequest);
            }
          }
        } catch (_) {}

        // 2) Legacy fallback (works only while access token still valid)
        try {
          const { data } = await api.post("/auth/refresh_token");
          if (data?.token) {
            localStorage.setItem("token", JSON.stringify(data.token));
            api.defaults.headers.Authorization = `Bearer ${data.token}`;
            return api(originalRequest);
          }
        } catch (_) {}
      }
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("companyId");
        api.defaults.headers.Authorization = undefined;
        setIsAuth(false);
      }
      return Promise.reject(error);
    }
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          let data;
          try {
            const res = await api.post("/auth/refresh_token");
            data = res?.data;
          } catch (e) {
            const storedRefresh = localStorage.getItem("refreshToken");
            if (storedRefresh) {
              let refreshToken = storedRefresh;
              try {
                refreshToken = JSON.parse(storedRefresh);
              } catch (_) {}
              const refreshed = await api.post("/auth/refresh", { refreshToken });
              if (refreshed?.data?.accessToken) {
                localStorage.setItem("token", JSON.stringify(refreshed.data.accessToken));
                if (refreshed.data.refreshToken) {
                  localStorage.setItem("refreshToken", JSON.stringify(refreshed.data.refreshToken));
                }
                api.defaults.headers.Authorization = `Bearer ${refreshed.data.accessToken}`;
                const res2 = await api.post("/auth/refresh_token");
                data = res2?.data;
              } else {
                throw e;
              }
            } else {
              throw e;
            }
          }
          // Mantém localStorage sincronizado com o token renovado.
          // Caso contrário, os interceptors continuam enviando o token antigo (expira em 15min)
          // e o usuário recebe 401 "Invalid token" em rotas como /helps.
          try {
            if (data?.token) localStorage.setItem("token", JSON.stringify(data.token));
          } catch (_) {}
          if (data?.token) api.defaults.headers.Authorization = `Bearer ${data.token}`;
          setIsAuth(true);
          setUser({
            ...data.user,
            queues: Array.isArray(data?.user?.queues) ? data.user.queues : [],
          });
        } catch (err) {
          toastError(err);
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (companyId) {
   
    const socket = socketConnection({ companyId });

      socket.on(`company-${companyId}-user`, (data) => {
        if (data.action === "update" && data.user.id === user.id) {
          setUser((prev) => ({
            ...(prev || {}),
            ...(data.user || {}),
            // preserva dados já carregados no login/refresh_token
            company: (data.user && data.user.company) || (prev && prev.company),
            queues: Array.isArray((data.user && data.user.queues) || (prev && prev.queues))
              ? ((data.user && data.user.queues) || (prev && prev.queues))
              : [],
          }));
        }
      });
    
    
    return () => {
      socket.disconnect();
    };
  }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogin = async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { companyId, id, company },
      } = data;

      if (has(company, "settings") && isArray(company.settings)) {
        const setting = company.settings.find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null); //regra pra exibir campanhas
        }
      }

      moment.locale('pt-br');
      const dueDate = data?.user?.company?.dueDate;
      const isSuper = Boolean(data?.user?.super);
      const dueDateValid = Boolean(dueDate && moment(dueDate).isValid());
      const isActiveByDueDate = dueDateValid ? moment().isBefore(dueDate) : true;

      // Regra: usuário master/super nunca deve ser bloqueado por vencimento no frontend.
      // Além disso, se não há dueDate válido, não bloqueia (evita "Invalid date").
      if (isSuper || !dueDateValid || isActiveByDueDate) {
        localStorage.setItem("token", JSON.stringify(data.token));
        if (data.refreshToken) {
          localStorage.setItem("refreshToken", JSON.stringify(data.refreshToken));
        }
        localStorage.setItem("companyId", companyId);
        localStorage.setItem("userId", id);
        if (dueDateValid) {
          localStorage.setItem("companyDueDate", moment(dueDate).format("DD/MM/yyyy"));
        } else {
          localStorage.removeItem("companyDueDate");
        }
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setUser({
          ...data.user,
          queues: Array.isArray(data?.user?.queues) ? data.user.queues : [],
        });
        setIsAuth(true);
        toast.success(i18n.t("auth.toasts.success"));
        // Notifica listeners globais (ex.: identidade visual) para recarregar config após login.
        try {
          window.dispatchEvent(new Event("tr-auth-updated"));
        } catch (_) {}
        // Aviso de vencimento só faz sentido quando existe dueDate válido e não é super
        if (dueDateValid && !isSuper) {
          const diff = moment(dueDate).diff(moment(moment()).format());
          const dias = moment.duration(diff).asDays();
          if (Math.round(dias) < 5) {
            toast.warn(`Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} `);
          }
        }
        history.push("/");
        setLoading(false);
      } else {
        const vencimento = dueDateValid ? moment(dueDate).format("DD/MM/yyyy") : "—";
        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
        setLoading(false);
      }

      //quebra linha 
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("companyId");
      localStorage.removeItem("userId");
      localStorage.removeItem("cshow");
      api.defaults.headers.Authorization = undefined;
      try {
        window.dispatchEvent(new Event("tr-auth-updated"));
      } catch (_) {}
      setLoading(false);
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (err) {
      toastError(err);
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
  };
};

export default useAuth;
