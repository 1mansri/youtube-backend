import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: process.env.LIMIT_FILE_SIZE || "200kb" }));
app.use(express.urlencoded({ limit: process.env.LIMIT_FILE_SIZE || "200kb", extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

export { app };