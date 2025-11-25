import { useState, useEffect } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { safeArray } from "../../utils/safe";

const useTickets = ({
  searchParam,
  tags,
  users,
  pageNumber,
  status,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTickets = async () => {
        try {
          const { data } = await api.get("/tickets", {
            params: {
              searchParam,
              pageNumber,
              tags,
              users,
              status,
              date,
              updatedAt,
              showAll,
              queueIds,
              withUnreadMessages,
            },
          });
          const list = Array.isArray(data) ? data : safeArray(data);
          setTickets(list);
          setHasMore(Boolean(data?.hasMore) || list.length > 0);
          setLoading(false);
        } catch (err) {
          // tenta fallback público sem auth
          try {
            const { data } = await api.get("/public/tickets", {
              params: {
                searchParam,
                pageNumber,
                tags,
                users,
                status,
                date,
                updatedAt,
                showAll,
                queueIds,
                withUnreadMessages,
              },
            });
            const list = Array.isArray(data) ? data : safeArray(data);
            setTickets(list);
            setHasMore(Boolean(data?.hasMore) || list.length > 0);
          } catch (e2) {
            toastError(err);
          } finally {
            setLoading(false);
          }
        }
      };
      fetchTickets();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    tags,
    users,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    queueIds,
    withUnreadMessages,
  ]);

  return { tickets, loading, hasMore };
};

export default useTickets;
