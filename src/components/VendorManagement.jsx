import React, { useState } from 'react'
import HVACTable from './HVACTable'
import RepublicServicesTable from './RepublicServicesTable'
import CertasiteTable from './CertasiteTable'

export default function VendorManagement() {
  const [activeVendor, setActiveVendor] = useState(null)

  const vendors = [
    { name: 'HVAC', color: '#3b82f6' },
    { name: 'Republic Services', color: '#10b981' },
    { name: 'Ceratsite', color: '#f59e0b' }
  ]

  return (
    <div className="vendor-management">
      <div className="vendor-header">
        <h2>Vendor Management</h2>
      </div>
      
      <div className="vendor-tabs">
        {vendors.map(vendor => (
          <button
            key={vendor.name}
            className={`vendor-tab ${activeVendor === vendor.name ? 'active' : ''}`}
            onClick={() => setActiveVendor(vendor.name)}
            style={{ 
              borderBottomColor: activeVendor === vendor.name ? vendor.color : 'transparent',
              color: activeVendor === vendor.name ? vendor.color : '#64748b'
            }}
          >
            {vendor.name}
          </button>
        ))}
      </div>

      <div className="vendor-content">
        {!activeVendor ? (
          <div className="vendor-placeholder">
            <p>Select a vendor to view details</p>
          </div>
        ) : activeVendor === 'HVAC' ? (
          <HVACTable />
        ) : activeVendor === 'Republic Services' ? (
          <RepublicServicesTable />
        ) : activeVendor === 'Ceratsite' ? (
          <CertasiteTable />
        ) : (
          <div className="vendor-details">
            <h3>{activeVendor}</h3>
            <p>Vendor management content for {activeVendor} will be displayed here.</p>
            {/* Add vendor-specific content here */}
          </div>
        )}
      </div>
    </div>
  )
}
