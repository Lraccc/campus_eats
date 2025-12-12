import { faPen, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig"; // Import axios config
import AlertModal from "../AlertModal";
import SubscriptionModal from "../shop/SubscriptionModal";
import "../css/userprofile.css";

const UserProfile = () => {
    const { logout, currentUser, updatePassword } = useAuth();
    const navigate = useNavigate();
    const [initialData, setInitialData] = useState({});
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [phone, setPhone] = useState('');
    const [dob, setDob] = useState('');
    const [confirmpwd, setConfirmpwd] = useState('');
    const [pwd, setPwd] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [username, setUsername] = useState('');
    const [editUsername, setEditUsername] = useState(false);
    const [courseYear, setCourseYear] = useState('');
    const [schoolIdNum, setSchoolIdNum] = useState('');
    const [oldPwd, setOldPwd] = useState('');
    const [accountType, setAccountType] = useState('');
    const [dasherData, setDasherData] = useState({});
    const [shopData, setShopData] = useState({});
    const [profilePicture, setProfilePicture] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: false,
      });

    useEffect(() => {
        const fetchUserData = async () => {
            if (currentUser) {
                try {
                    const response = await axios.get(`/users/${currentUser.id}`);
                    console.log("fetch user data:", response.data);
                    const data = response.data;

                    setInitialData(data);
                    // load profile picture if available
                    if (data.profilePictureUrl) {
                        setProfilePicture(data.profilePictureUrl);
                    }
                    console.log("initial data:", initialData);
                    setFirstname(data.firstname);
                    setLastname(data.lastname);
                    setUsername(data.username);
                    setPhone(data.phone || '');
                    setDob(data.dob || '');
                    setCourseYear(data.courseYear || '');
                    setSchoolIdNum(data.schoolIdNum || '');
                    setAccountType(data.accountType);
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            }
        };
        fetchUserData();
    }, [currentUser]);

    useEffect(() => {
        
        const fetchDasherData = async () => {
          try {
            const response = await axios.get(`/dashers/${currentUser.id}`);
            const data = response.data;
            setDasherData(data);
            console.log("fetch dasher data:", data);
          } catch (error) {
            console.error("Error fetching dasher data:", error);
          }
        };

        const fetchShopData = async () => {
            try {
                const response = await axios.get(`/shops/${currentUser.id}`);
                const data = response.data;
                setShopData(data);
                console.log("fetch shop data:", data);
            } catch (error) {
                console.error("Error fetching shop data:", error);
            }
        };

        if(initialData && initialData.accountType === 'dasher') {
            fetchDasherData();
        } else if(initialData && initialData.accountType === 'shop') {
            fetchShopData();
        }
      }, [initialData]);

    const isFormChanged = () => {
        return (
            firstname !== initialData.firstname ||
            lastname !== initialData.lastname ||
            phone !== (initialData.phone || '') ||
            dob !== (initialData.dob || '') ||
            courseYear !== (initialData.courseYear || '') ||
            schoolIdNum !== (initialData.schoolIdNum || '') ||
            username !== initialData.username ||
            pwd !== '' ||
            confirmpwd !== '' ||
            oldPwd !== ''
        );
    };

    const handleFileChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleUploadPicture = async () => {
        if (!imageFile || !currentUser) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', imageFile);

            const response = await axios.post(`/users/update-profile-picture/${currentUser.id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data && response.data.profilePictureUrl) {
                setProfilePicture(response.data.profilePictureUrl);
                setInitialData({ ...initialData, profilePictureUrl: response.data.profilePictureUrl });
                setImageFile(null);
                setImagePreview(null);
                setAlertModal({ isOpen: true, title: 'Success', message: 'Profile picture updated', showConfirmButton: false });
            }
        } catch (err) {
            console.error('Error uploading profile picture:', err);
            setAlertModal({ isOpen: true, title: 'Error', message: (err?.response?.data || err.message) + '', showConfirmButton: false });
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleCloseModal = () => {
        handleCancelImage();
        setIsModalOpen(false);
    };

    const handleSave = async () => {
        if (pwd && pwd !== confirmpwd) {
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'New passwords do not match',
                showConfirmButton: false,
              });
            return;
        }

        if (pwd && !passwordRegex.test(pwd)) {
            setAlertModal({
                isOpen: true,
                title: 'Password Requirements',
                message: 'New password must have at least 8 characters, one capital letter and one number',
                showConfirmButton: false,
              });
            return;
        }

        try {
            if (pwd) {
                await updatePassword(currentUser.id, oldPwd, pwd);
                console.log("Password updated successfully");
                setConfirmpwd('');
                setPwd('');
                setOldPwd('');
            }

            // Update other user data
            const response = await axios.put(`/users/update/${currentUser.id}`, {
                firstname,
                lastname,
                phone,
                dob,
                courseYear,
                schoolIdNum,
                username
            });

            const data = response.data;
            console.log("update profile response:", data);

            if (response.status === 200) {
                setAlertModal({
                    isOpen: true,
                    title: 'Success',
                    message: 'Profile updated successfully',
                    showConfirmButton: false,
                  }); 
                setEditMode(false);
                setEditUsername(false);
                setInitialData({
                    firstname,
                    lastname,
                    phone,
                    dob,
                    courseYear,
                    schoolIdNum,
                    username
                });
            }
        } catch (error) {
            console.error(error.response.data);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: '' + error.response.data,
                showConfirmButton: false,
              }); 
        }
    };

    return (
        <>
         <AlertModal
          isOpen={alertModal.isOpen}
          closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
          title={alertModal.title}
          message={alertModal.message}
          showConfirmButton={alertModal.showConfirmButton}
        />    
            <div className="p-body">
                <div className="p-content-current">
                    <div className="p-card-current">
                        <div className="p-container">
                            <div className="p-content">
                                <div className="p-img-holder">
                                    <div
                                        className="p-img-label"
                                        style={{ cursor: currentUser ? 'pointer' : 'default' }}
                                        onClick={() => currentUser && setIsModalOpen(true)}
                                    >
                                        <img
                                            src={imagePreview || profilePicture || initialData.profilePictureUrl || '/Assets/profile-picture.jpg'}
                                            alt="profile"
                                            className="p-img"
                                        />
                                        <div className="p-edit p-img-edit" title="Change profile picture">
                                            <FontAwesomeIcon style={{ fontSize: '12px' }} icon={faPen} />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-text">
                                    {editUsername ? (
                                        <div className="p-username-edit">
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="username-input"
                                            />
                                            <div className="p-edit" onClick={() => setEditUsername(false)}>
                                                <FontAwesomeIcon style={{fontSize: '15px'}} icon={faTimes} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-username">
                                            <h3>{username}</h3>
                                            <div className="p-edit" onClick={() => setEditUsername(true)}>
                                                <FontAwesomeIcon style={{fontSize: '12px'}} icon={faPen} />
                                            </div>
                                        </div>
                                    )}
                                    <h4>{currentUser?.email}</h4>
                                </div>
                            </div>
                            <div className="p-info">
                                <div className="p-two">
                                    <div className="p-field-two">
                                        <div className="p-label-two">
                                            <h3>First Name</h3>
                                            <input
                                                type="text"
                                                className="firstname"
                                                value={firstname}
                                                onChange={(e) => setFirstname(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-field-two">
                                        <div className="p-label-two">
                                            <h3>Last Name</h3>
                                            <input
                                                type="text"
                                                className="lastname"
                                                value={lastname}
                                                onChange={(e) => setLastname(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-two">
                                    <div className="p-field-two">
                                        <div className="p-label-two">
                                            <h3>Contact Number</h3>
                                            <input
                                                type="text"
                                                className="phone"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-field-two">
                                        <div className="p-label-two">
                                            <h3>Date of Birth</h3>
                                            <input
                                                type="date"
                                                className="dateofbirth"
                                                value={dob}
                                                onChange={(e) => setDob(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-two">
                                    <div className="p-field-two">
                                        <div className="p-label-two">
                                            <h3>Course & Year (e.g. BSIT-2)</h3> 
                                            <input
                                                type="text"
                                                className="courseyear"
                                                value={courseYear}
                                                onChange={(e) => setCourseYear(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-field-two">
                                        <div className="p-label-two">
                                            <h3>School ID</h3>
                                            <input
                                                type="text"
                                                className="schoolid"
                                                value={schoolIdNum}
                                                onChange={(e) => setSchoolIdNum(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                
                                <div className="p-two">
                                    {editMode && (
                                      <div className={editMode ? "p-field-two" : "p-field"}>
                                        <div className={editMode ? "p-label-two" : "p-label"}>
                                            <div className="p-label-icon">
                                                <h3>Old Password</h3>
                                                    <div className="p-edit" onClick={() => setEditMode(false)}>
                                                        <FontAwesomeIcon style={{fontSize: '15px'}} icon={faTimes} />
                                                        <h4>Cancel</h4>
                                                    </div>
                                            </div>
                                            {editMode && (
                                                <input
                                                    type="password"
                                                    className="password"
                                                    value={oldPwd}
                                                    onChange={(e) => setOldPwd(e.target.value)}
                                                />
                                            )}
                                        </div>
                                      </div>
                                    )}
                                    <div className={editMode ? "p-field-two" : "p-field"}>
                                        <div className={editMode ? "p-label-two" : "p-label"}>
                                            <div className="p-label-icon">
                                              {editMode && (
                                                <>
                                                <h3>New Password</h3>
                                                </>
                                                )}
                                                
                                                {!editMode && (
                                                  <>
                                                  <h3>Password</h3>
                                                    <div className="p-edit" onClick={() => setEditMode(true)}>
                                                        <FontAwesomeIcon style={{fontSize: '12px'}} icon={faPen} />
                                                        <h4>Edit</h4>
                                                    </div>
                                                    </>
                                                )}
                                            </div>
                                            {editMode && (
                                                <input
                                                    type="password"
                                                    className="password"
                                                    value={pwd}
                                                    onChange={(e) => setPwd(e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {editMode && (
                                        <>
                                            <div className="p-field-two">
                                                <div className="p-label-two">
                                                    <h3>Confirm New Password</h3>
                                                    <input
                                                        type="password"
                                                        className="confirmpwd"
                                                        value={confirmpwd}
                                                        onChange={(e) => setConfirmpwd(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                    
                                <div className="p-buttons">
                                    <button className="p-logout-button" onClick={logout}>Logout</button>
                                    <button className="p-save-button" onClick={handleSave} disabled={!isFormChanged()}>Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                    <div className="p-content-current p-content-current-small">
                        <div className="p-card-current">
                            <div className="p-upgrade-container">
                                <div className="p-content">
                                    <div className="p-upgrade-text">
                                        {accountType === 'dasher' ? (
                                        <>
                                            <h3>Wallet</h3>

                                            {dasherData && dasherData.wallet ? (
                                            <h4>₱{dasherData.wallet.toFixed(2)}</h4>
                                            ) : (
                                            <h4>₱0.00</h4>
                                            )}  
                                        </>
                                        ) : accountType === 'shop' ? (
                                        <> 
                                            {shopData && shopData.acceptGCASH=== true ? ( 
                                                <>
                                                <h3>Wallet</h3>

                                                {shopData && shopData.wallet ? (
                                                <h4>₱{shopData.wallet.toFixed(2)}</h4>
                                                ) : (
                                                <h4>₱0.00</h4>
                                                )}  
                                                </>
                                            ) : (
                                                <>
                                                <h3>Wallet</h3>
                                                <h4>Edit shop to activate</h4>
                                                </>
                                            )} 
                                        </> 
                                        ) : (
                                            <>
                                            <h3>Account Type</h3>
                                            <h4>{accountType ? accountType : ''}</h4>
                                            </>
                                        )}
                                    </div>
                                </div>
                            {accountType === 'shop' ? (
                                <div className="p-info">
                                    
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/cashout')} className="p-upgrade-button">Cash Out</button>
                                    </div>
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/shop-update')} className="p-upgrade-button">Edit Shop</button>
                                    </div>
                                </div>
                            ): accountType === 'dasher' ? (
                                <div className="p-info">
                                    
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/cashout')} className="p-upgrade-button">Cash Out</button>
                                    </div>
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/dasher-topup')} className="p-upgrade-button">Top Up</button>
                                    </div>
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/dasher-reimburse')} className="p-upgrade-button">No-Show</button>
                                    </div>
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/dasher-update')} className="p-upgrade-button">Edit Dasher Profile</button>
                                    </div>
                                </div>
                            ): accountType === 'admin' ? (
                                <>

                                </>
                            ): (
                        
                                <>
                                <div className="p-info">
                                    <div className="p-upgrade-buttons">
                                        <button onClick={() => navigate('/dasher-application')} className="p-upgrade-button">Be a Dasher</button>
                                        <button onClick={() => navigate('/shop-application')} className="p-upgrade-button">Add a Shop</button>
                                    </div>
                                </div>
                                </>
                                 
                            )}
                            </div>
                        </div>
                    </div>
                
            </div>

            {/* Inline modal for uploading profile picture */}
            {isModalOpen && (
                <div className="p-modal-overlay" onClick={handleCloseModal}>
                    <div className="p-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="p-modal-header">
                            <h3 style={{ margin: 0 }}>Update Profile Picture</h3>
                            <button className="p-modal-close" onClick={handleCloseModal} aria-label="Close">×</button>
                        </div>

                        <div className="p-modal-body">
                            <div className="p-modal-preview">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : profilePicture || initialData.profilePictureUrl ? (
                                    <img src={profilePicture || initialData.profilePictureUrl} alt="current" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ color: '#bbb' }}>No image</div>
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: 8, color: '#777' }}>Choose an image</label>
                                <input type="file" accept="image/*" onChange={handleFileChange} />
                                <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Recommended: square image, under 2MB.</p>
                            </div>
                        </div>

                        <div className="p-modal-actions">
                            <button className="p-cancel-button" onClick={() => { handleCancelImage(); }} disabled={isUploading}>Remove</button>
                            <button className="p-save-button small" onClick={async () => { await handleUploadPicture(); if (!isUploading) setIsModalOpen(false); }} disabled={!imageFile || isUploading}>
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UserProfile;
