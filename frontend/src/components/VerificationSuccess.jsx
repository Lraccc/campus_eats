import React from 'react';
import { Checkmark } from 'react-checkmark'

const VerificationSuccess = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center">
                <Checkmark size='xxLarge' />
                <h1 className="text-4xl font-bold mt-4">Verified!</h1>
                <p className="mt-2 text-lg text-gray-600">
                    Your email has been successfully verified! You can now close this tab and log in to your account.
                </p>
            </div>
        </div>
    );
};

export default VerificationSuccess;
