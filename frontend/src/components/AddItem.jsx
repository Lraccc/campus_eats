import "./css/AddItem.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTimes, faPlus, faMinus, faUpload } from '@fortawesome/free-solid-svg-icons';
import Navbar from "./Navbar/Navbar";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import axios from "../utils/axiosConfig";
import { useAuth } from "../utils/AuthContext";
import AlertModal from "./AlertModal";

const AddItem = () => {
  const { currentUser } = useAuth();
  const [success, setSuccess] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [categories, setCategories] = useState({
    food: false,
    drinks: false,
    clothing: false,
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
    others: false
  });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState(null);

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
      openModal('Input Required', 'Please select at least one category.');
      setLoading(false);
      return;
    }

    if (quantity < 1) {
      openModal('Input Required', 'Quantity must be at least 1.');
      setLoading(false);
      return;
    }

    if (!description) {
      openModal('Important Notice', 'You have not set a description. Are you sure you want to continue?', submitItem);
        setLoading(false);
        return;
    }

    if (!uploadedImage) {
      openModal('Important Notice', 'You have not set an item image. Are you sure you want to continue?', submitItem);
      setLoading(false);
      return;
    }
    openModal('Please Confirm', 'Are you sure you want to add this item?', submitItem);
  };

  const submitItem = async () => {
    const selectedCategories = Object.keys(categories).filter(category => categories[category]);
    const item = {
      name: itemName,
      price,
      quantity,
      description,
      categories: selectedCategories,
    };

    const formData = new FormData();
    formData.append("item", JSON.stringify(item));
    formData.append("shopId", currentUser.id);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const response = await axios.post(`/items/shop-add-item/${currentUser.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      openModal('Success', 'Item added successfully!');
      console.log("Item added successfully:", response.data);
      resetForm();
      setTimeout(() => {
        closeModal();
        navigate("/shop-manage-item");
      }, 3000);
  
    } catch (error) {
      console.error("Error making an item:", error.response.data.error);
      openModal('Error', 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItemName("");
    setPrice(0);
    setQuantity(1);
    setDescription("");
    setUploadedImage(null);
    setImageFile(null);
    setCategories({
      food: false,
      drinks: false,
      clothing: false,
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
      others: false,
    });
  };
  return (
    <>
      {loading && <div>Loading...</div>}
      <AlertModal 
        isOpen={isModalOpen} 
        closeModal={closeModal} 
        title={modalTitle} 
        message={modalMessage} 
        onConfirm={onConfirmAction} 
        showConfirmButton={!!onConfirmAction}
      />
      <div className="ai-body">
        <div className="ai-content-current">
          <div className="ai-card-current">
            <div className="ai-container">
              <form onSubmit={handleSubmit}>
                <div className="ai-info">
                  <h1>Add Item</h1>
                  <div className="ai-two">
                    <div className="ai-field-two ai-field-desc">
                      <div className="ai-label-two">
                        <h3>Item Name</h3>
                        <input
                          type="text"
                          className="item-name"
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="ai-field-two ai-field-desc">
                      <div className="ai-label-two">
                        <h3>Item Price</h3>
                        <input
                          type="number"
                          className="item-price"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="ai-field-two ai-field-desc">
                      <div className="ai-label-two">
                        <h3>Item Quantity</h3>
                        <input
                          type="number"
                          className="item-price"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="ai-two">
                    <div className="ai-field-two ai-field-desc">
                      <div className="ai-label-two">
                        <h3>Item Description</h3>
                        <textarea
                          className="item-desc"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="ai-upload">
                      <div className="ai-label-upload">
                        <h3>Item Picture</h3>
                      </div>
                      <div
                        className={`ai-upload-container ${dragOver ? "drag-over" : ""}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <label htmlFor="ai-govID" className="ai-drop-area">
                          <input
                            type="file"
                            hidden
                            id="ai-govID"
                            className="ai-govID-input"
                            onChange={handleFileChange}
                          />
                          <div className="ai-img-view">
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
                                <FontAwesomeIcon icon={faUpload} className="ai-upload-icon" />
                                <p>Drag and Drop or click here <br /> to upload image</p>
                              </>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                    <div className="ai-field-two">
                      <div className="ai-shop-categories">
                        <h3>Item Categories</h3>
                        <div className="ai-category-checkboxes">
                          {Object.keys(categories).map((category, index) => (
                            <div
                              key={index}
                              className={`ai-category-item ${categories[category] ? "selected" : ""}`}
                              onClick={() => handleCategoryChange(category)}
                            >
                              {category}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ai-buttons">
                    <button type="submit" className="ai-save-button" disabled={loading}>
                      {loading ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddItem;
