  import React, { useEffect, useState } from "react";
  import MapModal from "./MapModal";
  import "./css/ShopApplication.css";
  import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
  import { faUpload, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
  import Navbar from "./Navbar/Navbar";
  import { useNavigate } from "react-router-dom";
  import axios from "../utils/axiosConfig";
  import { useAuth } from "../utils/AuthContext";
  import AlertModal from './AlertModal';
  
  const ShopApplication = () => {
    
    const { currentUser } = useAuth();
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [latitude, setLatitude] = useState(10.294615);
    const [longitude, setLongitude] = useState(123.881124);
    const [loading, setLoading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [shopName, setShopName] = useState("");
    const [shopDesc, setShopDesc] = useState("");
    const [shopAddress, setShopAddress] = useState("");
    const [googleLink, setGoogleLink] = useState("");
    const [shopOpen, setShopOpen] = useState(null);
    const [shopClose, setShopClose] = useState(null);
    const [GCASHName, setGCASHName] = useState("");
    const [GCASHNumber, setGCASHNumber] = useState("");
    const [acceptGCASH, setAcceptGCASH] = useState(null);
    const [categories, setCategories] = useState({
      food: false,
      drinks: false,
      clothing: false,
      electronics: false,
      chicken: false,
      sisig: false,
      samgyupsal: false,
      "burger steak": false,
      pork: false,
      bbq: false,
      "street food": false,
      desserts: false,
      "milk tea": false,
      coffee: false,
      snacks: false,
      breakfast: false,
    });
    const navigate = useNavigate();

    const toggleMapModal = () => {
      setIsMapModalOpen(!isMapModalOpen);
    };

    const [alertModal, setAlertModal] = useState({
      isOpen: false,
      title: '',
      message: '',
      showConfirmButton: false,
    });

    const handleFileChange = (e) => {
      const file = e.target.files[0];
      setImageFile(file);
      processFile(file);
    };
    const handleDragOver = (e) => {
      e.preventDefault();
      setDragOver(true);
    };
    const handleDragLeave = () => {
      setDragOver(false);
    };
    const handleDrop = (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      setImageFile(file);
      processFile(file);
    };
    const processFile = (file) => {
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setUploadedImage(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };
    const handleCategoryChange = (category) => {
      setCategories({
        ...categories,
        [category]: !categories[category],
      });
    };
    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      
      const hasCategorySelected = Object.values(categories).some(
        (selected) => selected
      );
    
      if (!hasCategorySelected) {
        setAlertModal({
          isOpen: true,
          title: 'Action Needed',
          message: 'Please select at least one category.',
          showConfirmButton: false,
        });
        setLoading(false);
        return;
      }
    
      if (!uploadedImage) {
        setAlertModal({
          isOpen: true,
          title: 'Action Needed',
          message: 'Please upload a shop image.',
          showConfirmButton: false,
        });
        setLoading(false);
        return;
      }
    
      if (googleLink === "") {
        setAlertModal({
          isOpen: true,
          title: 'Action Needed',
          message: 'Please provide a valid Google Maps address link.',
          showConfirmButton: false,
        });
        setLoading(false);
        return;
      }
    
    
      if (shopOpen >= shopClose) {
        setAlertModal({
          isOpen: true,
          title: 'Invalid Time',
          message: 'Shop close time must be later than shop open time.',
          showConfirmButton: false,
        });
        setLoading(false);
        return;
      }

      if(acceptGCASH === true){
        if (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10) {
          setAlertModal({
            isOpen: true,
            title: 'Invalid Number',
            message: 'Please provide a valid GCASH Number.',
            showConfirmButton: false,
          });
          setLoading(false);
          return;
        }
      }

      if (acceptGCASH === null) {
        setAlertModal({
          isOpen: true,
          title: 'Action Needed',
          message: 'Please select whether you accept GCASH payment.',
          showConfirmButton: false,
        });
        setLoading(false);
        return;
      }
    
      console.log("Submitting form...");
      const selectedCategories = Object.keys(categories).filter(category => categories[category]);
      const shop = {
        gcashName: GCASHName,
        gcashNumber: GCASHNumber,
        categories: selectedCategories,
        googleLink,
        address: shopAddress,
        name: shopName,
        desc: shopDesc, 
        timeOpen: shopOpen,
        timeClose: shopClose,
        acceptGCASH,
      }
      console.log("Shop:", shop);
    
      const formData = new FormData();
      
      formData.append("image", imageFile);
      formData.append("userId", new Blob([currentUser.id], { type: "text/plain" }));
      formData.append("shop", new Blob([JSON.stringify(shop)], { type: "application/json" }));
    
      try {
        const response = await axios.post("/shops/apply", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        console.log("Response:", response);
    
        if (response.status === 200 || response.status === 201) {
          setAlertModal({
            isOpen: true,
            title: 'Success',
            message: 'Shop application submitted successfully! Please wait for admin approval.',
            showConfirmButton: false,
          });
          setTimeout(() => {
            navigate("/profile");
            window.location.reload();
          }, 2000);

        } else {
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Failed to submit shop application.',
            showConfirmButton: false,
          });
        }
        setLoading(false);
      } catch (error) {
        console.error("Error submitting form:", error);
        if (error.response && error.response.data) {
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Something went wrong. Please try again. Error: ' + error.response.data,
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
        setLoading(false);
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
        <div className="sa-body">
          <div className="sa-content-current">
            <div className="sa-card-current">
              <div className="sa-container">
                <div className="sa-content">
                  <div className="sa-text">
                    <h3>Shop Application</h3>
                    <h4>
                      Partner with CampusEats to help drive growth and take your
                      business to the next level.
                    </h4>
                  </div>
                </div>
                <div className="sa-info">
                  <form onSubmit={handleSubmit}>
                    <div className="sa-two">
                      <div className="sa-field-two">
                        <div className="sa-label-two">
                          <h3>Shop Name</h3>
                          <input
                            type="text"
                            className="shop-name"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="sa-field-two">
                        <div className="sa-label-two">
                          <h3>Shop Description</h3>
                          <input
                            type="text"
                            className="shop-desc"
                            value={shopDesc}
                            onChange={(e) => setShopDesc(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sa-two">
                      <div className="sa-field-two">
                        <div className="sa-label-two">
                          <h3>Shop Address</h3>
                          <input
                            type="text"
                            className="shop-address"
                            value={shopAddress}
                            onChange={(e) => setShopAddress(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="sa-field-two">
                        <div className="sa-label-two">
                          <h3>Location</h3>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px', // Adjust gap as needed
                            }}
                          >
                            {/* Read-only input box for Google Maps link */}
                            <input
                              type="text"
                              value={googleLink}  // Example Google link
                              readOnly
                              style={{
                                flex: 1, // Make the input take up remaining space
                                padding: '8px',
                                border: '1px solid #ccc',
                                backgroundColor: '#f9f9f9',
                                cursor: 'not-allowed', // Indicate that the input is not editable
                              }}
                            />
                            {/* Button to open the map modal */}
                            <button
                              type="button"
                              onClick={toggleMapModal}
                              style={{
                                padding: '10px 15px',
                                backgroundColor: '#cc514f', // Green color
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '7px',
                                fontSize: '12px',
                              }}
                            >
                              Pin Location
                            </button>
                            {googleLink !== "" && (
                            <button
                              type="button"
                              onClick={() => { window.open(googleLink, '_blank');}}
                              style={{
                                padding: '10px 15px',
                                backgroundColor: '#cc514f', // Green color
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '7px',
                                fontSize: '12px',
                              }}
                            >
                              <img src="/Assets/open-in-maps.svg" style={{width: '19px'}}/>
                            </button>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                    <div className="sa-shop-categories">
                        <h3>Accept GCASH Payment (Activates shop wallet)</h3>
                        <div className="sa-category-checkboxes">
                          <div
                            className={`sa-category-item ${acceptGCASH === true ? "selected" : ""}`}
                            onClick={() => setAcceptGCASH(true)}
                          >
                            Yes
                          </div>
                          <div
                            className={`sa-category-item ${acceptGCASH === false ? "selected" : ""}`}
                            onClick={() => setAcceptGCASH(false)}
                          >
                            No
                          </div>
                        </div>
                      </div>
                      {acceptGCASH === true && (
                    <div className="sa-two">
                      <div className="sa-field-two">
                        <div className="sa-label-two">
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
                      <div className="sa-field-two">
                        <div className="sa-label-two">
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
                  )}  
                    <div className="sa-two">
                      <div className="sa-field-two">
                        <div className="sa-label-two">
                          <h3>Shop Open Time</h3>
                          <input
                            type="time"
                            className="shosa-open"
                            value={shopOpen}
                            onChange={(e) => setShopOpen(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="sa-field-two">
                        <div className="sa-label-two">
                          <h3>Shop Close Time</h3>
                          <input
                            type="time"
                            className="shop-close"
                            value={shopClose}
                            onChange={(e) => setShopClose(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sa-two">
                      <div className="sa-upload">
                        <div className="sa-label-upload">
                          <h3>Shop Logo/Banner</h3>
                        </div>
                        <div
                          className={`sa-upload-container ${
                            dragOver ? "drag-over" : ""
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <label htmlFor="sa-govID" className="sa-drop-area">
                            <input
                              type="file"
                              hidden
                              id="sa-govID"
                              className="sa-govID-input"
                              onChange={handleFileChange}
                            />
                            <div className="sa-img-view">
                              {uploadedImage ? (
                                <img
                                  src={uploadedImage}
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
                      <div className="sa-shop-categories">
                        <h3>Shop Categories</h3>
                        <div className="sa-category-checkboxes">
                          {Object.keys(categories).map((category, index) => (
                            <div
                              key={index}
                              className={`sa-category-item ${
                                categories[category] ? "selected" : ""
                              }`}
                              onClick={() => handleCategoryChange(category)}
                            >
                              {category}
                            </div>
                          ))}
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
                      <button type="submit" disabled={loading} className="p-save-button">
                        Submit
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          
        </div>
        <MapModal
            isOpen={isMapModalOpen} // Show or hide the modal
            onClose={toggleMapModal} // Function to close the modal
            latitude={latitude} // Pass current latitude
            longitude={longitude} // Pass current longitude
            setLatitude={setLatitude} // Pass the setter function for latitude
            setLongitude={setLongitude}
            setGoogleLink={setGoogleLink}
          />
      </>
    );
  };
  export default ShopApplication;
