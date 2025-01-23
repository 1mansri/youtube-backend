import { asyncHandler } from "../utils/asyncHandler.js";

const registerUser = asyncHandler(async (req, res, next) => {
    res.status(200).json({ success: true, message: "User registered! chai aur code" });
});

export { registerUser };