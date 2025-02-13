import React from 'react';

const VerificationFailed = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center">
                <div className="text-red-500 text-8xl">❌</div>
                <h1 className="text-4xl font-bold mt-4">Verification Failed!</h1>
                <p className="mt-2 text-lg text-gray-600">
                    Oops! Something went wrong. Your email verification failed. Please try again or contact support for assistance.
                </p>
            </div>
        </div>
    );
};

export default VerificationFailed;
