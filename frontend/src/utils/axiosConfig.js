import axios from "axios";

export default axios.create({
    //baseURL: "https://campus-eats-backend.onrender.com/api",
    baseURL: "http://localhost:8080/api", // for local testing
    headers: {
        "ngrok-skip-browser-warning": "true",
    },
})