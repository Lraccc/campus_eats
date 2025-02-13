import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import AlertModal from "./AlertModal";
import "./css/AdminDasherLists.css";

const AdminDasherList = () => {
    const { currentUser } = useAuth();
    const [pendingDashers, setPendingDashers] = useState([]);
    const [currentDashers, setCurrentDashers] = useState([]);
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);

    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setOnConfirmAction(() => confirmAction);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setOnConfirmAction(null);
    };

    const handleDeclineClick = async (dasherId) => {
        openModal(
            'Confirm Decline',
            'Are you sure you want to decline this dasher?',
            async () => {
                try {
                    await axios.put(`/dashers/update/${dasherId}/status`, null, { params: { status: 'declined' } });
                    openModal('Success', 'Dasher status updated successfully');
                    setTimeout(() => {
                        closeModal();
                        window.location.reload();
                    }, 3000);
                } catch (error) {
                    console.error('Error updating dasher status:', error);
                    openModal('Error', 'Error updating dasher status');
                }
            }
        );
    };

    const handleAcceptClick = async (dasherId) => {
        openModal(
            'Confirm Accept',
            'Are you sure you want to accept this dasher?',
            async () => {
                try {
                    await axios.put(`/dashers/update/${dasherId}/status`, null, { params: { status: 'offline' } });
                    await axios.put(`/users/update/${dasherId}/accountType`, null, {
                        params: {
                            accountType: "dasher"
                        }
                    });
                    openModal('Success', 'Dasher status and account type updated successfully');
                    setTimeout(() => {
                        closeModal();
                        window.location.reload();
                    }, 3000);
                } catch (error) {
                    console.error('Error updating dasher status or account type:', error);
                    openModal('Error', 'Error updating dasher status or account type');
                }
            }
        );
    };

    useEffect(() => {
        const fetchDashers = async () => {
            setLoading(true);
            try {
                const response = await axios.get('/dashers/pending-lists');
                const pendingDashersHold = response.data.pendingDashers;
                console.log("pendingDashersHold: ", pendingDashersHold);
                const currentDashersHold = response.data.nonPendingDashers;
                console.log("currentDashersHold: ", currentDashersHold);
                const pendingDashersData = await Promise.all(
                    pendingDashersHold.map(async (dasher) => {
                        const pendingDashersDataResponse = await axios.get(`/users/${dasher.id}`);
                        const pendingDashersData = pendingDashersDataResponse.data;
                        return { ...dasher, userData: pendingDashersData };
                    })
                );
                const currentDashersData = await Promise.all(
                    currentDashersHold.map(async (dasher) => {
                        const currentDashersDataResponse = await axios.get(`/users/${dasher.id}`);
                        const currentDashersData = currentDashersDataResponse.data;
                        return { ...dasher, userData: currentDashersData };
                    })
                );
                console.log("pendingDashersData: ", pendingDashersData);
                console.log("currentDashersData: ", currentDashersData);

                setPendingDashers(pendingDashersData);
                setCurrentDashers(currentDashersData);
            } catch (error) {
                console.error('Error fetching dashers:', error.response.data.error);
            }finally{
                setLoading(false);
            }
        };

        fetchDashers();
        console.log("currentUser: ", currentUser);
    }, []);

    if(!currentUser){
        navigate('/login');
    }

    return (
        <>
            <AlertModal 
                isOpen={isModalOpen} 
                closeModal={closeModal} 
                title={modalTitle} 
                message={modalMessage} 
                onConfirm={onConfirmAction} 
                showConfirmButton={!!onConfirmAction}
            />
            <div className="adl-body">
                <div className="adl-title font-semibold">
                    <h2>Pending Dashers</h2>
                </div>
                {loading ? (<div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>): pendingDashers && pendingDashers.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Dasher Name</div>
                            <div className="adl-word">Days Available</div>
                            <div className="adl-word">Start Time</div>
                            <div className="adl-word">End Time</div>
                            <div className="adl-word">School ID</div>
                            <div className="adl-word">Actions</div>
                        </div>

                        <div className="adl-container">
                            {pendingDashers.map(dasher => (
                                <div key={dasher.id} className="adl-box">
                                    {console.log("dasher pending: ", dasher.userData.firstname)}
                                    <div className="adl-box-content">
                                        <div>{dasher.userData.firstname + " " + dasher.userData.lastname}</div>
                                        <div>{dasher.daysAvailable.join(', ')}</div>
                                        <div>{dasher.availableStartTime}</div>
                                        <div>{dasher.availableEndTime}</div>
                                        <div>
                                            <img src={dasher.schoolId} alt="School ID" className="adl-list-pic" />
                                        </div>
                                        <div className="adl-buttons">
                                            <button className="adl-decline" onClick={() => handleDeclineClick(dasher.id)}>Decline</button>
                                            <button className="adl-acceptorder" onClick={() => handleAcceptClick(dasher.id)}>Accept</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No pending dashers</div>
                )}

                <div className="adl-title font-semibold">
                    <h2>Dashers</h2>
                </div>
                {loading ? (<div className="flex justify-center items-center h-[40vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : currentDashers && currentDashers.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Dasher Name</div>
                            <div className="adl-word">Days Available</div>
                            <div className="adl-word">Start Time</div>
                            <div className="adl-word">End Time</div>
                            <div className="adl-word">School ID</div>
                            <div className="adl-word">Status</div>
                        </div>

                        <div className="adl-container">
                            {currentDashers.map(dasher => (
                                <div key={dasher.id} className="adl-box">
                                    {console.log("dasher current: ", dasher)}
                                    <div className="adl-box-content">
                                        <div>{dasher.userData.firstname + " " + dasher.userData.lastname}</div>
                                        <div>{dasher.daysAvailable.join(', ')}</div>
                                        <div>{dasher.availableStartTime}</div>
                                        <div>{dasher.availableEndTime}</div>
                                        <div>
                                            <img src={dasher.schoolId} alt="School ID" className="adl-list-pic" />
                                        </div>
                                        <div>{dasher.status}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No current dashers</div>
                )}
            </div>
        </>
    );
};

export default AdminDasherList;
