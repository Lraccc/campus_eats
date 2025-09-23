import React from 'react';
import "../css/CategoriesModal.css";

const CategoriesModal = ({ isOpen, onClose, categories, shopName }) => {
    if (!isOpen) return null;

    return (
        <div className="categories-modal-overlay" onClick={onClose}>
            <div className="categories-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="categories-modal-header">
                    <h3>All Categories</h3>
                    {shopName && <p className="shop-name">{shopName}</p>}
                    <button className="categories-modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="categories-modal-body">
                    <div className="categories-grid">
                        {categories.map((category, index) => (
                            <span key={index} className="category-tag">
                                {category}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoriesModal;