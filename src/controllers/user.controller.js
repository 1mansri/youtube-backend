import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshToken = async (userId) => 
    {
        try {
            const user = await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()
            
            user.refreshToken = refreshToken
            await user.save({validateBeforeSave: false})

            return { accessToken, refreshToken }
        
        } catch (error) {
        throw new ApiError(500, "Something went wrong, Failed to generate tokens")
        }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response


    const {fullName, email, username, password } = req.body
    // console.log("email:",  email)

    if (
        [fullName, email, username, password].some( (field) => {
            field?.trim() === ""
        })
    ) {
        throw new ApiError(400, "Please provide all required fields")
    }

    const existedUser = await User.findOne({ 
        $or: [
            { email },
            { username },
        ]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    
    // console.log(req.files)

    const avatrLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    
    if (!avatrLocalPath) {
        throw new ApiError(400, "Please provide avatar image")
    }

    const avatar = await uploadOnCloudinary(avatrLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar){
        throw new ApiError(500, "Failed to upload avatar image")
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if (!createdUser) {
        throw new ApiError(500, "Failed to create user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Successfully registered")
    )
    
})

const loginUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty. username or email fields
    // check if user exists: email
    // check password
    // generate access token
    // generate refresh token
    // send cookie to frontend

    try {
        const { email, username, password } = req.body
        
            
        if(!email && !username) {
            throw new ApiError(400, "Please provide email or username")
        }
        
        // if(!(email || username)) {
        //     throw new ApiError(400, "Please provide email or username")
        // }
    
        const user = await User.findOne({
            $or: [
                { email },
                { username }
            ]
        })
        
        if (!user) {
            throw new ApiError(404, "User not found")
        }
    
        const isPasswordValid = await user.isPasswordCorrect(password)
    
        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid user credentials")
        }
        
        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
    
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    
        const options = {
            httpOnly: true,
            secure: true
        }
        
        
        return res.status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                user: loggedInUser, accessToken, refreshToken
                }, 
                "User successfully logged in"
            )
        )
    } catch (error) {
        throw new ApiError(500, "Something went wrong, Failed to login user")
    }
})

const logoutUser = asyncHandler( async(req, res) => {
    // remove refresh token from db
    // remove refresh token from cookie
    try {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: { 
                    refreshToken: undefined
                }
            }
        )
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User successfully logged out"
            )
        )
    } catch (error) {
        throw new ApiError(500, "Something went wrong, Failed to logout user")
    }
    
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Not authenticated request")
    }
    
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken, 
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
        
        if (!user) {
            throw new ApiError(401, "Not authenticated request")
        }
        if ( user?.refreshToken!== incomingRefreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "User successfully refreshed access token"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Not authenticated request or invalid refresh token")
        
    }
    
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
 }