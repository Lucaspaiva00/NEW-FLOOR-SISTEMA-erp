const API_URL_DEV = "http://localhost:3000";
const API_URL_PROD = "https://new-floor-sistema-erp.onrender.com";

const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";

const API_URL = isLocal ? API_URL_DEV : API_URL_PROD;
