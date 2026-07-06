// src/pages/patient/PatientHelp.jsx
import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Mail, PhoneCall } from "lucide-react";
import "../../styles/dashboard.css";

export default function PatientHelp() {
  const [openFaq, setOpenFaq] = useState(null);
  
  const faqs = [
    {
      q: "How do I log a missed medication?",
      a: "If you missed a medication, go to 'Today's Schedule' from the sidebar. You will see a list of today's medications. If the time has passed, you can still click the 'Take' button to log it as taken late, or you can leave it as missed."
    },
    {
      q: "Can I change the reminder sound?",
      a: "Yes! Navigate to Settings > Notifications & Audio, and ensure 'Alert Sounds' is turned on. Currently, the app uses a standard medical chime, but custom sound selection is coming soon."
    },
    {
      q: "How do I contact my caregiver?",
      a: "Your caregiver can view your adherence in real-time from their dashboard. If you need to send them a message directly, you can do so by calling the emergency contact number listed in your Profile."
    },
    {
      q: "What does 'Overall Adherence' mean?",
      a: "Overall Adherence is a percentage calculated by dividing the number of medications you have marked as 'Taken' by the total number of medications you were scheduled to take over a specific time period."
    }
  ];

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Help & Support</h1>
          <p className="dash-sub">Find answers or contact your healthcare provider</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Support Contact Cards */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '50%', color: '#059669', marginBottom: '1rem' }}>
              <PhoneCall size={32} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Call Support</h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Available 24/7 for technical emergencies.</p>
            <a href="tel:1-800-555-0199" style={{ padding: '0.75rem 1.5rem', background: '#059669', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 600 }}>
              1-800-555-0199
            </a>
          </div>
          
          <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ padding: '1rem', background: '#ede9ff', borderRadius: '50%', color: '#6c63ff', marginBottom: '1rem' }}>
              <Mail size={32} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Email Clinician</h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Send a direct secure message to your doctor.</p>
            <button style={{ padding: '0.75rem 1.5rem', background: '#6c63ff', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Compose Message
            </button>
          </div>
        </div>

        {/* FAQs */}
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle size={20} color="var(--text-primary)" /> Frequently Asked Questions
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {faqs.map((faq, index) => (
              <div key={index} style={{ borderBottom: index === faqs.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                <button 
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    width: '100%', padding: '1.25rem 0', background: 'transparent', border: 'none', 
                    cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem'
                  }}
                >
                  {faq.q}
                  {openFaq === index ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                </button>
                {openFaq === index && (
                  <div style={{ paddingBottom: '1.25rem', color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </>
  );
}

