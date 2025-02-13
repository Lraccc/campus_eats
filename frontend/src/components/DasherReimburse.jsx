import React, { useEffect, useState } from "react";
import "./css/ShopApplication.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import Navbar from "./Navbar/Navbar";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { useAuth } from "../utils/AuthContext";
import AlertModal from './AlertModal';

const DasherReimburse = () => {
const { currentUser } = useAuth();
const [gcashQr, setGcashQr] = useState(null);
const [imageFile_gcashQr, setImageFile_gcashQr] = useState(null);
const [dragOver_gcashQr, setDragOver_gcashQr] = useState(false);
const [GCASHName, setGCASHName] = useState("");
const [GCASHNumber, setGCASHNumber] = useState("");
const [noShowOrders, setNoShowOrders] = useState([]);
const [selectedOrder, setSelectedOrder] = useState(null);
const [amount, setAmount] = useState(0);
const [locationProof, setLocationProof] = useState(null);
const [imageFile_locationProof, setImageFile_locationProof] = useState(null);
const [dragOver_locationProof, setDragOver_locationProof] = useState(false);
const [noShowProof, setNoShowProof] = useState(null);
const [imageFile_noShowProof, setImageFile_noShowProof] = useState(null);
const [dragOver_noShowProof, setDragOver_noShowProof] = useState(false);   
const navigate = useNavigate();

const [alertModal, setAlertModal] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
  showConfirmButton: false,
});

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

  useEffect(() => {
    const fetchDasherData = async () => {
      try {
        const response = await axios.get(`/dashers/${currentUser.id}`);
        const data = response.data;
        setGCASHName(data.gcashName);
        setGCASHNumber(data.gcashNumber);
      } catch (error) {
        console.error("Error fetching dasher data:", error);
      }
    };

    const fetchNoShowOrders = async () => {
        try {
          const response = await axios.get(`/orders/dasher/no-show-orders/${currentUser.id}`);
          const data = response.data;
          setNoShowOrders(data);
          console.log("No show orders: ", data);
        } catch (error) {
          console.error("Error fetching dasher data:", error);
        }
      };

    fetchDasherData();
    fetchNoShowOrders();
  }, [currentUser]);

  

  const handleOrderChange = (e) => {
    const orderId = e.target.value;
    const selected = noShowOrders.find(order => order.id === orderId); // Assuming each order has a unique id
    setSelectedOrder(selected);
    if (selected) {
      setAmount(selected.totalPrice);
    }
  };
  // GCASH QR file handling
  const handleFileChange_gcashQr = (e) => {
    const file = e.target.files[0];
    setImageFile_gcashQr(file);
    processFile_gcashQr(file);
  };

  const handleDragOver_gcashQr = (e) => {
    e.preventDefault();
    setDragOver_gcashQr(true);
  };

  const handleDragLeave_gcashQr = () => {
    setDragOver_gcashQr(false);
  };

  const handleDrop_gcashQr = (e) => {
    e.preventDefault();
    setDragOver_gcashQr(false);
    const file = e.dataTransfer.files[0];
    setImageFile_gcashQr(file);
    processFile_gcashQr(file);
  };

  const processFile_gcashQr = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGcashQr(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Location Proof file handling
  const handleFileChange_locationProof = (e) => {
    const file = e.target.files[0];
    setImageFile_locationProof(file);
    processFile_locationProof(file);
  };

  const handleDragOver_locationProof = (e) => {
    e.preventDefault();
    setDragOver_locationProof(true);
  };

  const handleDragLeave_locationProof = () => {
    setDragOver_locationProof(false);
  };

  const handleDrop_locationProof = (e) => {
    e.preventDefault();
    setDragOver_locationProof(false);
    const file = e.dataTransfer.files[0];
    setImageFile_locationProof(file);
    processFile_locationProof(file);
  };

  const processFile_locationProof = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocationProof(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // No Show Proof file handling
  const handleFileChange_noShowProof = (e) => {
    const file = e.target.files[0];
    setImageFile_noShowProof(file);
    processFile_noShowProof(file);
  };

  const handleDragOver_noShowProof = (e) => {
    e.preventDefault();
    setDragOver_noShowProof(true);
  };

  const handleDragLeave_noShowProof = () => {
    setDragOver_noShowProof(false);
  };

  const handleDrop_noShowProof = (e) => {
    e.preventDefault();
    setDragOver_noShowProof(false);
    const file = e.dataTransfer.files[0];
    setImageFile_noShowProof(file);
    processFile_noShowProof(file);
  };

  const processFile_noShowProof = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNoShowProof(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
  
    if (!gcashQr) {
      setAlertModal({
        isOpen: true,
        title: 'Image Required',
        message: 'Please upload a GCASH QR image.',
        showConfirmButton: false,
      });
      return;
    }

    if (!locationProof) {
      setAlertModal({
        isOpen: true,
        title: 'Location Proof Image Required',
        message: 'Please upload a location proof image.',
        showConfirmButton: false,
      });
      return;
    }

    if (!noShowProof) {
        setAlertModal({
          isOpen: true,
          title: 'No Show Proof Image Required',
          message: 'Please upload a no show proof image.',
          showConfirmButton: false,
        });
        return;
        }
  
    if (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10) {
      setAlertModal({
        isOpen: true,
        title: 'Invalid Number',
        message: 'Please provide a valid GCASH Number.',
        showConfirmButton: false,
      });
      return;
    }

    if (selectedOrder === null) {
        setAlertModal({
          isOpen: true,
          title: 'Order Required',
          message: 'Please select an order.',
          showConfirmButton: false,
        });
        return;
    }

    
    const reimburse = {
      gcashName: GCASHName,
      gcashNumber: GCASHNumber,
      amount: selectedOrder.totalPrice + 5,
      orderId: selectedOrder.id,
      dasherId: currentUser.id,
    };
  
    const formData = new FormData();
    console.log("noShowProof: ", imageFile_noShowProof);  
    formData.append("reimburse", new Blob([JSON.stringify(reimburse)], { type: "application/json" }));
    formData.append("gcashQr", imageFile_gcashQr);
    formData.append("locationProof", imageFile_locationProof);
    formData.append("noShowProof", imageFile_noShowProof);
    formData.append("userId", currentUser.id);
  
    try {
      const response = await axios.post("/reimburses/create", formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log("response: ", response);
  
      if (response.status === 200 || response.status === 201) {
        setAlertModal({
          isOpen: true,
          title: 'Success',
          message: 'Reimburse request submitted successfully.',
          showConfirmButton: false,
        });
        setTimeout(() => {
          navigate("/profile");
          setAlertModal(prev => ({ ...prev, isOpen: false }));
        }, 3000);
      } else {
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: 'Failed to submit dasher application.',
          showConfirmButton: false,
        });
      }
    } catch (error) {
      if (error.response && error.response.data) {
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: 'There was an error. Please try again. Error: ' + error.response.data,
          showConfirmButton: false,
        });
      } else {
        console.error("Error submitting form:", error);
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: 'Error submitting form',
          showConfirmButton: false,
        });
      }
    }
  };
  

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
      <div className="p-body">
        <div className="p-content-current">
          <div className="p-card-current">
            <div className="p-container">
              <div className="p-content">
                <div className="p-text">
                  <h3>Request for Reimbursement</h3>
                  <h4>
                    It may take up to 3-5 business days for the amount to be reflected in your GCASH account.
                  </h4>
                </div>
              </div>
              <div className="p-info">
                <form onSubmit={handleSubmit}>

                  
                <div className="p-two">
                    <div className="p-field-two">
                      <div className="sa-label-two">
                        <h3>Select Order</h3>
                        <select onChange={handleOrderChange} required>
                          <option value="">-- Select Order --</option>
                          {noShowOrders.map((order) => (
                            <option key={order.id} value={order.id}>
                              {formatDate(order.createdAt)} {/* Assuming createdAt is a valid date */}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="p-field-two">
                      <div className="p-label-two">
                        <h3>Amount to receive</h3>
                        <div className="gcash-input-container" style={{color: '#515050'}}>
                          <input
                            type="text"
                            className="gcash-num"
                            value={`₱${amount.toFixed(2)} + ₱5 (Inconvenience Fee)`}
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-two">
                    <div className="sa-upload">
                      <div className="sa-label-upload">
                        <h3>Proof of Location Arrival</h3>
                      </div>
                      <div
                        className={`sa-upload-container ${
                          dragOver_locationProof ? "drag-over" : ""
                        }`}
                        // style={{height: "400px", width: "250px"}}
                        onDragOver={handleDragOver_locationProof}
                        onDragLeave={handleDragLeave_locationProof}
                        onDrop={handleDrop_locationProof}
                      >
                        <label htmlFor="locationProof" className="sa-drop-area">
                          <input
                            type="file"
                            hidden
                            id="locationProof"
                            className="sa-govID-input"
                            onChange={handleFileChange_locationProof}
                          />
                          <div className="sa-img-view">
                            {locationProof ? (
                              <img
                                src={locationProof}
                                alt="Uploaded"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "20px",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <>
                                <FontAwesomeIcon
                                  icon={faUpload}
                                  className="sa-upload-icon"
                                />
                                <p>
                                  Drag and Drop or click here <br /> to upload
                                  image
                                </p>
                              </>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                    <div className="sa-upload">
                      <div className="sa-label-upload">
                        <h3>Proof of Attempt</h3>
                      </div>
                      <div
                        className={`sa-upload-container ${
                          dragOver_noShowProof ? "drag-over" : ""
                        }`}
                        // style={{height: "400px", width: "250px"}}
                        onDragOver={handleDragOver_noShowProof}
                        onDragLeave={handleDragLeave_noShowProof}
                        onDrop={handleDrop_noShowProof}
                      >
                        <label htmlFor="noShowProof" className="sa-drop-area">
                          <input
                            type="file"
                            hidden
                            id="noShowProof"
                            className="sa-govID-input"
                            onChange={handleFileChange_noShowProof}
                          />
                          <div className="sa-img-view">
                            {noShowProof ? (
                              <img
                                src={noShowProof}
                                alt="Uploaded"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "20px",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <>
                                <FontAwesomeIcon
                                  icon={faUpload}
                                  className="sa-upload-icon"
                                />
                                <p>
                                  Drag and Drop or click here <br /> to upload
                                  image
                                </p>
                              </>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>

                    
                    
                  </div>
                  <div className="p-two">
                    <div className="p-field-two">
                      <div className="p-label-two">
                        <h3>GCASH Name</h3>
                        <input
                          type="text"
                          className="gcash-name"
                          value={GCASHName}
                          onChange={(e) => setGCASHName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="p-field-two">
                      <div className="p-label-two">
                        <h3>GCASH Number</h3>
                        <div className="gcash-input-container">
                          <span className="gcash-prefix">+63 </span>
                          <input
                            type="number"
                            className="gcash-num"
                            value={GCASHNumber}
                            onChange={(e) => setGCASHNumber(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-two">
                    <div className="sa-upload">
                      <div className="sa-label-upload">
                        <h3>GCASH Personal QR Code</h3>
                      </div>
                      <div
                        className={`sa-upload-container ${
                          dragOver_gcashQr ? "drag-over" : ""
                        }`}
                        // style={{height: "400px", width: "250px"}}
                        onDragOver={handleDragOver_gcashQr}
                        onDragLeave={handleDragLeave_gcashQr}
                        onDrop={handleDrop_gcashQr}
                      >
                        <label htmlFor="gcashQr" className="sa-drop-area">
                          <input
                            type="file"
                            hidden
                            id="gcashQr"
                            className="sa-govID-input"
                            onChange={handleFileChange_gcashQr}
                          />
                          <div className="sa-img-view">
                            {gcashQr ? (
                              <img
                                src={gcashQr}
                                alt="Uploaded"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "20px",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <>
                                <FontAwesomeIcon
                                  icon={faUpload}
                                  className="sa-upload-icon"
                                />
                                <p>
                                  Drag and Drop or click here <br /> to upload
                                  image
                                </p>
                              </>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>

                    
                    
                  </div>
                  <div className="p-buttons">
                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      className="p-logout-button"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="p-save-button">
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DasherReimburse;
