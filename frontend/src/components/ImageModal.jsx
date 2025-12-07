// ImageModal.js
import React from 'react';
import './css/ImageModal.css'; // You can create a separate CSS file for styling

const ImageModal = ({ isOpen, imageSrc, onClose }) => {
    // Define a handleKeyDown function to close the modal on Escape key press
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    // Use useEffect to add/remove keydown event listener
    React.useEffect(() => {
        // Only add event listener if the modal is open
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        // Clean up the event listener on component unmount or when isOpen changes
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]); // Dependency array includes isOpen

    // If not open, don't render anything
    if (!isOpen) return null;

    // Log for debugging
    console.log('🖼️ ImageModal rendering with imageSrc:', imageSrc);

    return (
        <div className="image-modal-overlay" onClick={onClose}>
            <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                <span className="image-close-button" onClick={onClose}>&times;</span>
                <img 
                    src={imageSrc} 
                    alt="Proof Image" 
                    className="image-modal-image"
                    onError={(e) => {
                        console.error('❌ Image failed to load:', imageSrc);
                        e.target.alt = 'Failed to load image';
                    }}
                    onLoad={() => console.log('✅ Image loaded successfully:', imageSrc)}
                />
            </div>
        </div>
    );
};

export default ImageModal;
