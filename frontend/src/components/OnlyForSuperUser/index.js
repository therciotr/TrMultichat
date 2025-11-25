const OnlyForSuperUser = ({ user, yes, no }) => {
  const isAdmin = !!(user && (
    user.super || user.admin || (String(user.profile || "").toLowerCase() === "admin") ||
    String(user.email || "").toLowerCase() === "thercio@trtecnologias.com.br"
  ));
  return isAdmin ? yes() : no();
};

OnlyForSuperUser.defaultProps = {
    user: {},
	yes: () => null,
	no: () => null,
};

export default OnlyForSuperUser;