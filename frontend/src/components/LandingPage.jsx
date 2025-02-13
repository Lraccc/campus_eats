import React from 'react';
import './css/LandingPage.css';
import Navbar from './Navbar/Navbar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowCircleRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';


const LandingPage = () => {
  // const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className='landing-page'>
        
      <div className="image-container">     
        <img src={'/Assets/clouds.svg'} alt="Cloud" className="cloud-image" />
        <img src={'/Assets/big-cloud.svg'} alt="Big Cloud" className="big-cloud-image" />
        <img src={'/Assets/goose.svg'} alt="Goose" className="goose-image" />
      </div>
      <div className="delivery-text">
        <p>Enjoy your favorite food, <br />
          delivered straight to you</p>
          <button onClick={() => navigate('/home')} className="delivery-button">
          <span>Order now!</span>
          <FontAwesomeIcon icon={faArrowCircleRight} className='icon'/>
          </button>
      </div>
      <div className='title-info1'>
        <h1>Track your CampusEats <br />
           orders straight to your door</h1>
           <div className="info1-container">
        <p>Enjoy your favorite meals delivered promptly. <br />
           Follow your student courier’s journey from pickup to delivery, and receive notifications when they are approaching.</p>
      </div>
      </div>
      
    </div>
  );
};

export default LandingPage;
