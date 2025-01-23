const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).
        catch((error) => next(error))
    }
}
    
export { asyncHandler }












// const asyncHandler = (fn) => async(req, res, next) => {
//     try {
//         await fn(req, res, next);
//     } catch (error) {
//         res.status(error.statusCode || 500).json({ 
//             success: false,
//             error: error.message 
//         });
//     }
// };
    
// export { asyncHandler };