import React, { useState } from 'react'
import ActionItemManagement from './ActionItemManagement'
import VendorManagement from './VendorManagement'

export default function PropertyManagement() {
  const [activeTab, setActiveTab] = useState(null)

  if (!activeTab) {
    return (
      <div className="property-home">
        <div className="property-header">
          <h1>Property Management</h1>
          <p className="property-tagline">Comprehensive management system for property operations</p>
        </div>
        
        <div className="property-tabs-grid">
          <div 
            className="property-tab-card action-items"
            onClick={() => setActiveTab('action-items')}
          >
            <div className="property-tab-icon">📋</div>
            <h2>Action Item Management</h2>
            <p>Track and manage action items across your team</p>
            <button className="property-tab-btn">Open →</button>
          </div>
          
          <div 
            className="property-tab-card vendors"
            onClick={() => setActiveTab('vendors')}
          >
            <div className="property-tab-icon">🏢</div>
            <h2>Vendor Management</h2>
            <p>Manage relationships with service vendors</p>
            <button className="property-tab-btn">Open →</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="property-content">
      <div className="property-nav">
        <h2>Property Management</h2>
        <button className="back-property-btn" onClick={() => setActiveTab(null)}>
          ← Back to Main Menu
        </button>
      </div>
      
      {activeTab === 'action-items' && <ActionItemManagement />}
      {activeTab === 'vendors' && <VendorManagement />}
    </div>
  )
}
