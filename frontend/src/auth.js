import axios from "axios";

const API = "http://localhost:5000/api/inscription";

export const login = async (data) => {
  const res = await axios.post(`${API}/login`, data);
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