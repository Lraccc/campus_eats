import Tooltip from '@mui/material/Tooltip';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import AlertModal from './AlertModal';
import DasherCashoutModal from "./DasherCashoutModal";
import "./css/ShopApplication.css";

const DasherCashout = () => {
const { currentUser } = useAuth();
const [cashout, setCashout] = useState(null);
const [selectedImage, setSelectedImage] = useState(null);
const [imageModalOpen, setImageModalOpen] = useState(false);
const [isModalOpen, setIsModalOpen] = useState(false);
const [GCASHName, setGCASHName] = useState("");
const [GCASHNumber, setGCASHNumber] = useState("");
const [cashoutAmount, setCashoutAmount] = useState(0);
const [uploadedImage, setUploadedImage] = useState(null);
const [imageFile, setImageFile] = useState(null);
const [wallet, setWallet] = useState(0);
const [isEditMode, setIsEditMode] = useState(false);
const [editData, setEditData] = useState(null);
const [dasherData, setDasherData] = useState({});
const [accountType, setAccountType] = useState(''); 
const [shopData, setShopData] = useState({}); 
const [loading, setLoading] = useState(false);
  
const [alertModal, setAlertModal] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
  showConfirmButton: true,
});


  const navigate = useNavigate();

  const handleImageClick = (imageSrc) => {
    setSelectedImage(imageSrc);
    setImageModalOpen(true);
  };

  const closeModal = () => {
    setImageModalOpen(false); // Close the modal
    setSelectedImage(""); // Reset selected image
};

 const fetchCashoutData = async () => {
    try {
      setLoading(true);
        const response = await axios.get(`/cashouts/${currentUser.id}`);
        const cashout = response.data;
           if(cashout && cashout.status !== 'paid' && cashout.status !== 'declined'){
            setCashout(cashout);
           }
    } catch (error) {
        console.error("Error fetching cashout data:", error);
    }finally{
      setLoading(false);
    }
};

const fetchDasherData = async () => {
    try {
      const response = await axios.get(`/dashers/${currentUser.id}`);
      setDasherData(response.data);
    } catch (error) {
      console.error("Error fetching dasher data:", error);
    }
};

const fetchShopData = async () => {
  try {
    const response = await axios.get(`/shops/${currentUser.id}`);
    setShopData(response.data);
  } catch (error) {
    console.error("Error fetching dasher data:", error);
  }
};

const fetchUserAccountType = async () => {
  try {
      const response = await axios.get(`/users/${currentUser.id}/accountType`);
      setAccountType(response.data); 
      console.log("admin route account type: ", response.data);

      if(response.data === 'dasher'){
        fetchDasherData();
      }else if(response.data === 'shop'){
        fetchShopData();
      }
      // Directly setting the response data since it's a plain string
  } catch (error) {
      console.error('Error fetching user account type:', error);
  }
};

  useEffect(() => {
    fetchCashoutData();
    fetchUserAccountType();
    
  }, [currentUser]);



  const handleDeleteClick = async (id) => {
    try {
      const response = await axios.delete(`/cashouts/delete/${id}`);
      console.log("Response:", response);

      if (response.status !== 200) {
        throw new Error(response.data.error || "Failed to delete cashout request");
      }

      setCashout(null);

      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Cashout request deleted successfully.',
        showConfirmButton: false,
      });
      setTimeout(() => {
          setAlertModal({ ...alertModal, isOpen: false });
      }, 3000);
      
    } catch (error) {
      console.error("Error deleting cashout request:", error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'There was an error. Please try again. Error: ' + error.message,
        showConfirmButton: false,
      });
    }
  };


const HandleEditClick = async (id) => {
    try {
      const response = await axios.get(`/cashouts/${id}`);
      const data = response.data;
      setEditData(data);
      setGCASHName(data.gcashName);
      setGCASHNumber(data.gcashNumber);
      setCashoutAmount(data.amount);
      setUploadedImage(data.gcashQr);
      setIsEditMode(true);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching cashout data:", error);
    }
  };

    console.log("Cashout:", cashout)
  ;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    
    // Extracting the components
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2); // Get last 2 digits of the year
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12; // Convert to 12-hour format
    hours = hours ? String(hours).padStart(2, '0') : '12'; // If hour is 0, set it to 12

    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
};


  const openModal = () => {
    setIsEditMode(false);
    setIsModalOpen(true);
  };
 const closeIt = () => setIsModalOpen(false);

  return (
    <>
    <AlertModal
                isOpen={alertModal.isOpen}
                closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                onConfirm={alertModal.onConfirm}
                showConfirmButton={alertModal.showConfirmButton}
            />
            <div className="adl-body">
                <div className="adl-title">
                   {cashout === null ? <h2>You have no pending cashout request </h2> : <h2>You have a pending cashout request</h2>}
                </div>
                <div className="adl-row-container">
                    <div className="adl-word">Timestamp</div>
                    <div className="adl-word">GCASH Name</div>
                    <div className="adl-word">GCASH Number</div>
                    <div className="adl-word">Amount</div>
                    <div className="adl-word">GCASH QR</div>
                    <div className="adl-word">Actions</div>
                </div>

                <div className="adl-container">
                    {cashout && (
                      <div key={cashout.id} className="adl-box">
                        <div className="adl-box-content">
                          <div>{formatDate(cashout.createdAt)}</div>
                          <div>{cashout.gcashName}</div>
                          <div>{cashout.gcashNumber}</div>
                          <div>₱{cashout.amount.toFixed(2)}</div>
                          <div>
                            <img 
                              src={cashout.gcashQr} 
                              alt="GCASH QR" 
                              className="adl-list-pic" 
                              onClick={() => handleImageClick(cashout.gcashQr)} 
                            />
                          </div>
                          <div className="adl-buttons">
                            <button className="adl-decline" onClick={() => handleDeleteClick(cashout.id)}>Delete</button>
                            <button className="adl-acceptorder" onClick={() => HandleEditClick(cashout.id)}>Edit</button>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                <Tooltip title={cashout ? "You can only have one pending cashout request at a time." : ""}>
                    <span>
                      <button
                        onClick={openModal}
                        disabled={cashout !== null} 
                        className="mt-2 rounded-md bg-red-700 py-2 px-4 border border-transparent text-center text-sm text-white transition-all shadow-md hover:shadow-lg focus:shadow-none hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none ml-2"
                        type="button"
                      >
                        Request Cashout
                      </button>
                    </span>
                </Tooltip>

                <DasherCashoutModal isOpen={isModalOpen} onClose={closeIt}
                accountType={accountType}
        data={accountType === 'dasher' ? dasherData : shopData}
        isEditMode={isEditMode}
        editData={editData}
        currentUser={currentUser}
                />
            </div>
        </>
     

  );
};

export default DasherCashout;
