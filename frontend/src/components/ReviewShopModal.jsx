import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import AlertModal from './AlertModal';

const ReviewShopModal = ({ isOpen, onClose, order, shop }) => {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    showConfirmButton: false,
  });

  const handleRating = (rate) => {
    setRating(rate);
  };

  const handleSubmit = async () => {
    if (rating === 0 || !order.shopId) {
      setAlertModal({
        isOpen: true,
        title: 'Action Needed',
        message: 'Please provide a rating.',
        showConfirmButton: false,
      });
      return;
    }

    const ratingData = {
      shopId: order.shopId,
      rate: rating,
      comment: reviewText,
      type: "shop",
      orderId: order.id,
    };

    try {
      await axios.post('/ratings/shop-create', ratingData);
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.response?.data.error,
        showConfirmButton: false,
      });
      
    }
  };

  const handleOverlayClick = (e) => {
    // Prevent the modal from closing when clicking inside the map
    e.stopPropagation();
  };

  return (
    isOpen && (
      <>
        <AlertModal
          isOpen={alertModal.isOpen}
          closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
          title={alertModal.title}
          message={alertModal.message}
          showConfirmButton={alertModal.showConfirmButton}
        />
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-40"  onClick={onClose}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative" onClick={handleOverlayClick}>
            <button 
              className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" 
              onClick={onClose}
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">Share Your Experience</h3>
            <div className="mb-4">
              <h4 className="mb-2 text-center">Rate {shop.name}</h4>
              <div className="flex space-x-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span 
                    key={star}
                    className={`cursor-pointer text-4xl ${rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                    onClick={() => handleRating(star)}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <textarea
              className="w-full h-24 border border-gray-300 rounded-lg p-2 resize-none"
              placeholder="Write your review here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <div className="flex justify-end mt-4">
              <button 
                className="bg-yellow-500 text-white px-5 py-2 rounded-lg hover:bg-yellow-600 transition duration-200" 
                onClick={handleSubmit}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </>
    )
  );
};

export default ReviewShopModal;
