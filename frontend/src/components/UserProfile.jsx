import { faPen, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig"; // Import axios config
import AlertModal from "./AlertModal";
import "./css/userprofile.css";

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
                                    <img src={'/Assets/profile-picture.jpg'} alt="food" className="p-img"/>
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
                                        <button onClick={() => navigate('/dasher-reimburse')} className="p-upgrade-button">Reimbursement</button>
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
        </>
    );
};

export default UserProfile;
