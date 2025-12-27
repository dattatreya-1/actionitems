import React from 'react'

export default function HomePage({ onSelectTab }) {
  const teamMembers = [
    { 
      name: 'Florence', 
      color: 'linear-gradient(135deg, #6c5ce7, #a29bfe)'
    },
    { 
      name: 'Dan', 
      color: 'linear-gradient(135deg, #0984e3, #74b9ff)'
    },
    { 
      name: 'Kams', 
      color: 'linear-gradient(135deg, #00b894, #55efc4)'
    },
    { 
      name: 'Sunny', 
      color: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)'
    },
    { 
      name: 'Admin', 
      color: 'linear-gradient(135deg, #d63031, #ff7675)'
    }
  ]

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>Action Tracker Pro</h1>
        <p className="tagline">Manage and track action items across your team</p>
      </div>

      <div className="team-grid">
        {teamMembers.map(member => (
          <div 
            key={member.name} 
            className="team-card"
            onClick={() => onSelectTab(member.name)}
            style={{ background: member.color }}
          >
            <h3>{member.name}</h3>
            <p>View {member.name === 'Admin' ? 'all' : `${member.name}'s`} action items</p>
            <button className="view-btn">View Dashboard →</button>
          </div>
        ))}
      </div>

      <div className="home-footer">
        <div className="feature-grid">
          <div className="feature">
            <div className="feature-icon">📊</div>
            <h4>Analytics & Reports</h4>
            <p>Comprehensive workload analysis and pivot tables</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🔍</div>
            <h4>Advanced Filters</h4>
            <p>Filter by deadline, priority, status, and more</p>
          </div>
          <div className="feature">
            <div className="feature-icon">✏️</div>
            <h4>Edit & Manage</h4>
            <p>Add, edit, and delete action items in real-time</p>
          </div>
          <div className="feature">
            <div className="feature-icon">⏱️</div>
            <h4>Time Tracking</h4>
            <p>Track minutes, hours, and days for deliverables</p>
          </div>
        </div>
      </div>
    </div>
  )
}
