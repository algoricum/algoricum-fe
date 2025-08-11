// / Add the PDF generation function
import jsPDF from "jspdf";

export const generateAndDownloadBAA = () => {
  const doc = new jsPDF();
  
  // Set up the document
  doc.setFont("helvetica");
  
  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Business Associate Agreement (BAA)", 105, 30, { align: "center" });
  
  // Subtitle
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Algoricum Healthcare Solutions", 105, 45, { align: "center" });
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 60);
  
  // Main content
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Introduction from Hilda - Compliance Officer", 20, 80);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  
  const content = [
    "Dear Healthcare Partner,",
    "",
    "I'm Hilda, your dedicated compliance officer at Algoricum. This Business Associate",
    "Agreement outlines the essential rules and regulations that govern our partnership",
    "in handling protected health information (PHI).",
    "",
    "KEY REGULATIONS AND REQUIREMENTS:",
    "",
    "1. HIPAA COMPLIANCE",
    "   • All PHI must be handled according to HIPAA Privacy and Security Rules",
    "   • Data encryption is mandatory for all transmissions",
    "   • Access controls must be implemented and regularly audited",
    "",
    "2. DATA HANDLING PROTOCOLS",
    "   • PHI can only be used for specified healthcare operations",
    "   • No unauthorized disclosure of patient information",
    "   • Secure disposal of PHI when no longer needed",
    "",
    "3. SECURITY SAFEGUARDS",
    "   • Administrative: Appointed security officer, workforce training",
    "   • Physical: Facility access controls, workstation security",
    "   • Technical: Access control, audit controls, integrity controls",
    "",
    "4. INCIDENT RESPONSE",
    "   • Immediate reporting of any suspected breaches",
    "   • Documentation of all security incidents",
    "   • Corrective action plans for identified vulnerabilities",
    "",
    "5. BUSINESS ASSOCIATE OBLIGATIONS",
    "   • Implement appropriate safeguards to protect PHI",
    "   • Report any unauthorized use or disclosure",
    "   • Ensure subcontractors comply with same standards",
    "   • Return or destroy PHI upon contract termination"
  ];
  
  let yPosition = 95;
  
  content.forEach((line) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    
    if (line === "") {
      yPosition += 8;
    } else if (line.includes("KEY REGULATIONS") || line.includes("HIPAA COMPLIANCE") || 
               line.includes("DATA HANDLING") || line.includes("SECURITY SAFEGUARDS") ||
               line.includes("INCIDENT RESPONSE") || line.includes("BUSINESS ASSOCIATE")) {
      doc.setFont("helvetica", "bold");
      doc.text(line, 20, yPosition);
      yPosition += 12;
    } else if (line.startsWith("   •")) {
      doc.setFont("helvetica", "normal");
      doc.text(line, 25, yPosition);
      yPosition += 10;
    } else if (line.match(/^\d+\./)) {
      doc.setFont("helvetica", "bold");
      doc.text(line, 20, yPosition);
      yPosition += 10;
    } else {
      doc.setFont("helvetica", "normal");
      doc.text(line, 20, yPosition);
      yPosition += 10;
    }
  });
  
  // Add footer content
  if (yPosition > 220) {
    doc.addPage();
    yPosition = 20;
  } else {
    yPosition += 20;
  }
  
  doc.setFont("helvetica", "bold");
  doc.text("AGREEMENT TERMS:", 20, yPosition);
  yPosition += 15;
  
  const agreementTerms = [
    "By accepting this agreement, both parties acknowledge:",
    "",
    "• Understanding of all HIPAA requirements and regulations",
    "• Commitment to maintaining the highest standards of data protection",
    "• Regular compliance audits and assessments will be conducted",
    "• Any violations will result in immediate contract termination",
    "",
    "For questions or clarifications, please contact:",
    "Hilda Thompson, Compliance Officer",
    "Email: hilda@algoricum.com",
    "Phone: (555) 123-4567",
    "",
    "This agreement is effective immediately upon acceptance and remains",
    "in effect for the duration of our business relationship.",
    "",
    "Thank you for your commitment to patient privacy and data security.",
    "",
    "Sincerely,",
    "Hilda Thompson",
    "Compliance Officer, Algoricum Healthcare Solutions"
  ];
  
  doc.setFont("helvetica", "normal");
  agreementTerms.forEach((line) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    
    if (line === "") {
      yPosition += 8;
    } else if (line.startsWith("•")) {
      doc.text(line, 25, yPosition);
      yPosition += 10;
    } else if (line.includes("Hilda Thompson") || line.includes("AGREEMENT TERMS")) {
      doc.setFont("helvetica", "bold");
      doc.text(line, 20, yPosition);
      doc.setFont("helvetica", "normal");
      yPosition += 10;
    } else {
      doc.text(line, 20, yPosition);
      yPosition += 10;
    }
  });
  
  // Save the PDF
  doc.save("Algoricum_BAA.pdf");
};