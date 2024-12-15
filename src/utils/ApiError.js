class ApiError extends Error {
    constructor(
        statusCode, 
        message= "Something went wrong",
        errors = [],
        statck = ''
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.sucess = false;
        this.errors = errors;
        this.data = null

        if (statck) {
            this.statck = statck;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError }