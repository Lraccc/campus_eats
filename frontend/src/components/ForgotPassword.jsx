import React, { useState, useEffect } from "react";
import "./css/ForgotPassword.css";
import { useAuth } from "../utils/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosConfig";

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

    useEffect(() => {
        document.title = "Campus Eats";
    }, []);

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
                    params: { email }
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
                const errorMessage = error.response?.data?.message || error.message;
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
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
                                    <div className="fp-input-wrap">
                                        <input
                                            type="text"
                                            id="code"
                                            required
                                            readOnly={loading}
                                            className={`fp-input-field ${codeFocus || code ? 'active' : ''}`}
                                            onChange={(e) => setCode(e.target.value)}
                                            onFocus={() => setCodeFocus(true)}
                                            onBlur={() => setCodeFocus(false)}
                                        />
                                        <label>Code</label>
                                    </div>
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
