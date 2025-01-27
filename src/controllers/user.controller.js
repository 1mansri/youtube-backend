import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
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

const changeCurrentPassword = asyncHandler(async (req, res) => {
    
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }
    
    user.password = newPassword
    await user.save({validateBeforeSave: true})
    
    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Password successfully changed"
        )
    )
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse (200, req.user, "User successfully fetched"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email, username } = req.body
    
    if (!fullName || !email ) {
        throw new ApiError(400, "Please provide at least one field to update")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email.toLowerCase(),
                username
            }
        },
        { new: true }
    ).select("-password")

    return res
    .status(200)
    .json( new ApiResponse(200, user, "User successfully updated"))
    
    
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please provide avatar image")
    }

    try {
        // Get the current user with their avatar URL
        const currentUser = await User.findById(req.user?._id);
        if (!currentUser) {
            throw new ApiError(404, "User not found")
        }

        // Upload new avatar
        const avatar = await uploadOnCloudinary(avatarLocalPath);

        if (!avatar?.url){
            throw new ApiError(400, "Failed to upload avatar image")
        }
        
        // If upload successful, delete the old avatar
        if (currentUser.avatar) {
            try {
                await deleteFromCloudinary(currentUser.avatar);
            } catch (error) {
                console.log("Error deleting old avatar:", error);
                // Continue execution even if deletion fails
            }
        }
        
        // Update user with new avatar URL
        const user = await User.findByIdAndUpdate(  
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            { new: true }
        ).select("-password")
        
        if (!user) {
            throw new ApiError(500, "Failed to update user avatar")
        }

        return res
        .status(200)
        .json(new ApiResponse(200, user, "User avatar successfully updated"))

    } catch (error) {
        throw new ApiError(
            error.statusCode || 500,
            error.message || "Error while updating avatar"
        )
    }
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Please provide cover image")
    }

    try {
        // Get the current user with their cover image URL
        const currentUser = await User.findById(req.user?._id);
        if (!currentUser) {
            throw new ApiError(404, "User not found")
        }

        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if (!coverImage?.url){
            throw new ApiError(400, "Failed to upload cover image")
        }

        // If upload successful, delete the old cover
        if (currentUser.coverImage) {
            try {
                await deleteFromCloudinary(currentUser.coverImage);
            } catch (error) {
                console.log("Error deleting old cover image:", error);
                // Continue execution even if deletion fails
            }
        }
        
        // Update user with new cover URL
        const user = await User.findByIdAndUpdate(  
            req.user?._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            { new: true }
        ).select("-password")
        
        if (!user) {
            throw new ApiError(500, "Failed to update user cover image")
        }

        return res
        .status(200)
        .json(new ApiResponse(200, user, "User cover image successfully updated"))

    } catch (error) {
        throw new ApiError(
            error.statusCode || 500,
            error.message || "Error while updating cover image"
        )
    }
})

const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new ApiError(400, "Please provide username")
    }

    const channel = await User.aggregate([
        
        {
            $match: { username: username?.toLowerCase() }
        },
        {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
           $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond:{
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
                    
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                createdAt: 1,
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not found")
    }
    
    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel profile successfully fetched"))
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage
 }