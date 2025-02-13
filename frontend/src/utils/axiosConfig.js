import axios from "axios";

export default axios.create({
    baseURL: "https://campuseats-production.up.railway.app/api",
    headers: {
        "ngrok-skip-browser-warning": "true",
    },
})