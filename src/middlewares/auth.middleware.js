import {asyncHandler} from "../utils/asyncHandler";
import {ApiError} from "../utils/ApiError";

import {User} from "./models/user.model";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const token = req.cookie?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            throw new ApiError(401, "Not authenticated");
        }
        
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        
        if (!user){
            throw new ApiError(401, "Not Access Token")
        }
    
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Not authenticated");
    }
})