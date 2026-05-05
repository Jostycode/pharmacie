import axios from "axios";

const API = "http://localhost:3000/api/utilisateur";

export const login = async (data) => {
  const res = await axios.post(`${API}/connexion`, data);
  localStorage.setItem("token", res.data.token);
  localStorage.setItem("user", JSON.stringify(res.data.user));
  return res.data.user;
};

export const logout = () => {
  localStorage.clear();
};

export const getUser = () => {
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
};

export const isAuth = () => !!localStorage.getItem("token");