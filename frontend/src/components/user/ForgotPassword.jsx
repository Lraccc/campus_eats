import React, { useState, useEffect } from "react";
import "../css/ForgotPassword.css";
import { useAuth } from "../../utils/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "../../utils/axiosConfig";

const ForgotPassword = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [emailFocus, setEmailFocus] = useState(false);
    const [codeFocus, setCodeFocus] = useState(false);
    const [validEmail, setValidEmail] = useState(true);
    const [codeSent, setCodeSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
    const [canResend, setCanResend] = useState(false);
    const [codeExpired, setCodeExpired] = useState(false);

    useEffect(() => {
        document.title = "Campus Eats";
    }, []);

    // Function to check verification code status
    const checkCodeStatus = async () => {
        if (!email || !codeSent) return;
        
        try {
            const response = await axios.get('/users/verificationCodeStatus', {
                params: { email }
            });
            
            if (response.data.expired) {
                setCodeExpired(true);
                setCanResend(true);
                setCountdown(0);
            } else {
                setCodeExpired(false);
                setCountdown(response.data.remainingTime);
                setCanResend(response.data.remainingTime <= 0);
            }
        } catch (err) {
            console.error("Error checking code status:", err);
        }
    };

    // Countdown timer effect
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => {
                    const newCountdown = prev - 1;
                    if (newCountdown <= 0) {
                        setCanResend(true);
                        setCodeExpired(true);
                    }
                    return newCountdown;
                });
            }, 1000);
        } else {
            setCanResend(true);
            setCodeExpired(true);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    // Check code status when code is sent
    useEffect(() => {
        if (codeSent) {
            checkCodeStatus();
        }
    }, [codeSent, email]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (!email) {
            setLoading(false);
            return setError('Please enter your email');
        }

        if (!codeSent) {
            console.log("email", email);
            try {
                const emailCheckResponse = await axios.get(`/users/by-email/${email}`);
                console.log("emailCheckResponse", emailCheckResponse);
                if (!emailCheckResponse.data) {
                    setLoading(false);
                    return setError("Email address doesn't exist");
                }

                const sendCodeResponse = await axios.post(`/users/sendVerificationCode`, null, {
                    params: { email, isMobile: true }
                });

                console.log("sendCodeResponse", sendCodeResponse);
                if (sendCodeResponse.status === 200) {
                    setCodeSent(true);
                    setSuccess('Check your inbox for the code. Enter the code to reset your password.');
                } else {
                    setError('Failed to send verification code. Please try again.');
                }
            } catch (error) {
                const errorMessage = error.response?.data?.message || error.message;
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        } else {
            if (!code) {
                setLoading(false);
                return setError('Please enter the code sent to your email');
            }

            if (codeExpired) {
                setLoading(false);
                return setError('Verification code has expired. Please request a new one.');
            }

            try {
                const verifyCodeResponse = await axios.post(`/users/verifyCode`, null, {
                    params: { email, enteredCode: code }
                });
                console.log("verifyCodeResponse", verifyCodeResponse);

                if (verifyCodeResponse.status === 200 && verifyCodeResponse.data === 'success') {
                    setSuccess('Your password has been reset successfully. You may now log in with your new password.');
                    navigate('/reset-password', { state: { email } });
                } else {
                    setError("Incorrect verification code. Please try again.");
                }
            } catch (error) {
                const errorMessage = error.response?.data || error.message;
                setError(errorMessage);
                
                // If the error indicates code expiration, update the state
                if (errorMessage.includes("expired")) {
                    setCodeExpired(true);
                    setCanResend(true);
                    setCountdown(0);
                }
            } finally {
                setLoading(false);
            }
        }
    };

    const handleResendCode = async () => {
        if (!canResend) return;

        setLoading(true);
        setError('');
        setCodeExpired(false);

        try {
            console.log('Resending verification code for:', email);
            const response = await axios.post('/users/sendVerificationCode', null, {
                params: {
                    email,
                    isMobile: true
                }
            });

            console.log('Resend response:', response.data);

            if (response.data) {
                // Reset the countdown to 10 minutes (600 seconds)
                setCountdown(600);
                setCanResend(false);
                setCodeExpired(false);
                setCode(''); // Clear the code input
                setSuccess('Verification code has been resent to your email.');
            }
        } catch (err) {
            console.error("Resend error:", err);
            setError("Failed to resend code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="fp-main">
            <div className={`fp-box ${codeSent ? 'fp-big-box' : ''}`}>
                <div className="fp-inner-box">
                    <div className="fp-forms-wrap">
                        <form className="fp-form" onSubmit={handleSubmit}>
                            <div className="fp-header">
                                <h1>Forgot Password</h1>
                            </div>
                            {!loading && error && (
                                <div className="ls-error">
                                    <span>{error}</span>
                                </div>
                            )}

                            {!loading && success && (
                                <div className="ls-success">
                                    <span>{success}</span>
                                </div>
                            )}
                            <div className="fp-actual-form">
                                <div className="fp-input-wrap">
                                    <input
                                        type="text"
                                        id="email"
                                        required
                                        disabled={loading || codeSent}
                                        className={`fp-input-field ${emailFocus || email ? 'active' : ''}`}
                                        onChange={(e) => setEmail(e.target.value)}
                                        aria-invalid={validEmail ? "false" : "true"}
                                        aria-describedby="uidnote"
                                        onFocus={() => setEmailFocus(true)}
                                        onBlur={() => setEmailFocus(false)}
                                    />
                                    <label>Email</label>
                                </div>
                                {codeSent && (
                                    <>
                                        <div className="fp-input-wrap">
                                            <input
                                                type="text"
                                                id="code"
                                                required
                                                readOnly={loading || codeExpired}
                                                className={`fp-input-field ${codeFocus || code ? 'active' : ''} ${codeExpired ? 'disabled' : ''}`}
                                                onChange={(e) => setCode(e.target.value)}
                                                onFocus={() => setCodeFocus(true)}
                                                onBlur={() => setCodeFocus(false)}
                                            />
                                            <label>Code</label>
                                        </div>
                                        
                                        {/* Code Expiration Warning */}
                                        {codeExpired && (
                                            <div className="ls-error">
                                                <span>Verification code has expired</span>
                                            </div>
                                        )}
                                        
                                        {/* Resend Code Section */}
                                        <div className="fp-resend-section">
                                            <p className="fp-resend-text">
                                                {codeExpired ? "Code expired?" : "Didn't receive the code?"}
                                            </p>
                                            <button
                                                type="button"
                                                className={`fp-resend-btn ${(!canResend || loading) ? 'disabled' : ''}`}
                                                onClick={handleResendCode}
                                                disabled={!canResend || loading}
                                            >
                                                {canResend
                                                    ? "Resend Code"
                                                    : `Resend in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`}
                                            </button>
                                            {!codeExpired && countdown > 0 && (
                                                <p className="fp-countdown-text">
                                                    Code expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                                <button disabled={loading} type="submit" className="fp-btn">
                                    {codeSent ? "Reset Password" : loading ? "Sending Code..." : "Send Code"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default ForgotPassword;
