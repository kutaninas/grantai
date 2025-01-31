import React, { useState, useRef } from 'react';
import { Upload, FileText, Send, Info, HelpCircle, Mail, Phone, X, MessageSquare, ChevronDown, ChevronUp, Menu, LogOut, History, Clock, Download, Edit2, Save, Copy, Folder, FolderOpen } from 'lucide-react';
import axios from 'axios';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './AuthContext';
import { ProposalResponse, ProjectGroup } from './types';

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

function App() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [requirements, setRequirements] = useState('');
  const [projectName, setProjectName] = useState('');
  const [proposalHistory, setProposalHistory] = useState<ProposalResponse[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [editingProposal, setEditingProposal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const { isAuthenticated, user, logout } = useAuth();

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleGetStarted = () => {
    if (!isAuthenticated) {
      setAuthMode('register');
      setShowAuthModal(true);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) {
      console.log('No files selected');
      return;
    }

    console.log('Files selected:', fileList.length);
    setUploadError(null);
    const selectedFiles = Array.from(fileList);

    if (selectedFiles.length > 5) {
      console.log('Too many files selected:', selectedFiles.length);
      setUploadError('Maximum 5 files allowed');
      return;
    }

    const invalidFiles = selectedFiles.filter(file => 
      !file.name.toLowerCase().endsWith('.txt') && 
      !file.name.toLowerCase().endsWith('.docx')
    );

    if (invalidFiles.length > 0) {
      console.log('Invalid file types detected:', invalidFiles.map(f => f.name));
      setUploadError('Only .txt and .docx files are supported');
      return;
    }

    const totalFiles = files.length + selectedFiles.length;
    if (totalFiles > 5) {
      console.log('Total files would exceed limit:', totalFiles);
      setUploadError('Maximum 5 files allowed in total');
      return;
    }

    console.log('Processing files:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));

    const fileInfos = selectedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type
    }));

    setFiles(prevFiles => [...prevFiles, ...fileInfos]);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
      console.log('Appending file to FormData:', file.name);
    });

    console.log('Initiating upload to server...');
    
    fetch('http://localhost:8000/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      console.log('Server response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Server response:', data);
      if (data.message !== 'Files uploaded successfully') {
        console.error('Upload failed:', data);
        setUploadError('Error uploading files');
        setFiles(prevFiles => prevFiles.filter(f => !fileInfos.some(fi => fi.name === f.name)));
      } else {
        console.log('Upload successful:', data);
      }
    })
    .catch(error => {
      console.error('Upload error:', error);
      setUploadError('Error uploading files. Please try again.');
      setFiles(prevFiles => prevFiles.filter(f => !fileInfos.some(fi => fi.name === f.name)));
    })
    .finally(() => {
      console.log('Upload process completed');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadError(null);
  };

  const handleRemoveAllFiles = () => {
    setFiles([]);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateProjectGroups = (proposals: ProposalResponse[]) => {
    const groupedProposals = proposals.reduce((acc: ProjectGroup[], proposal) => {
      const existingGroup = acc.find(g => g.projectName === proposal.projectName);
      if (existingGroup) {
        existingGroup.proposals.push(proposal);
      } else {
        acc.push({
          projectName: proposal.projectName,
          proposals: [proposal],
          isCollapsed: false
        });
      }
      return acc;
    }, []);

    groupedProposals.sort((a, b) => {
      const aLatest = new Date(a.proposals[0].timestamp).getTime();
      const bLatest = new Date(b.proposals[0].timestamp).getTime();
      return bLatest - aLatest;
    });

    setProjectGroups(groupedProposals);
  };

  React.useEffect(() => {
    const savedProposals = localStorage.getItem('proposalHistory');
    if (savedProposals) {
      const proposals = JSON.parse(savedProposals);
      setProposalHistory(proposals);
      updateProjectGroups(proposals);
    }
  }, []);

  const handleGenerate = async () => {
    if (!requirements.trim()) {
      alert('Please enter requirements');
      return;
    }

    if (!projectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requirements })
      });
      const data = await response.json();
      
      const newProposal: ProposalResponse = {
        id: crypto.randomUUID(),
        proposal: data.proposal,
        requirements: requirements,
        timestamp: new Date().toISOString(),
        projectName: projectName
      };

      const updatedHistory = [newProposal, ...proposalHistory];
      setProposalHistory(updatedHistory);
      updateProjectGroups(updatedHistory);
      
      localStorage.setItem('proposalHistory', JSON.stringify(updatedHistory));
      
    } catch (error) {
      console.error('Error generating proposal:', error);
      alert('Error generating proposal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    setEditingProposal(id);
    const proposal = proposalHistory.find(p => p.id === id);
    if (proposal && editTextareaRef.current) {
      editTextareaRef.current.value = proposal.editedProposal || proposal.proposal;
    }
  };

  const handleSave = (id: string) => {
    if (!editTextareaRef.current) return;
    
    const updatedProposals = proposalHistory.map(p => {
      if (p.id === id) {
        return {
          ...p,
          editedProposal: editTextareaRef.current?.value
        };
      }
      return p;
    });
    
    setProposalHistory(updatedProposals);
    localStorage.setItem('proposalHistory', JSON.stringify(updatedProposals));
    setEditingProposal(null);
  };

  const handleDownload = (proposal: ProposalResponse) => {
    const content = proposal.editedProposal || proposal.proposal;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${new Date(proposal.timestamp).toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleProjectCollapse = (projectName: string) => {
    setProjectGroups(prev => prev.map(group => 
      group.projectName === projectName 
        ? { ...group, isCollapsed: !group.isCollapsed }
        : group
    ));
  };

  const faqItems = [
    {
      question: "What file formats are supported?",
      answer: "We support .txt and .docx files for proposal uploads. You can upload multiple files at once."
    },
    {
      question: "How many previous proposals can I upload?",
      answer: "You can upload up to 5 previous proposals to help guide the AI in generating your new proposal."
    },
    {
      question: "How long does it take to generate a proposal?",
      answer: "Generation typically takes 1-2 minutes, depending on the complexity of your requirements and the length of reference materials."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, all uploaded files and generated proposals are processed securely and are not stored permanently on our servers."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-slate-800">Grant Proposal Generator</h1>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => scrollToSection(faqRef)}
                  className="text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  FAQ
                </button>
                <button 
                  onClick={() => scrollToSection(contactRef)}
                  className="text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  Contact
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">Welcome, {user?.name}</span>
                  <button
                    onClick={logout}
                    className="text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={handleLogin}
                    className="hidden md:block text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Log In
                  </button>
                  <button 
                    onClick={handleGetStarted}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"
                  >
                    Get Started
                  </button>
                </>
              )}
              <button className="md:hidden text-slate-600 hover:text-slate-800">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Transform Your Grant Writing Process</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Leverage AI to create compelling grant proposals based on your successful past applications and specific requirements.
          </p>
        </div>

        <div className="grid gap-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-2xl font-semibold mb-8 text-slate-800 flex items-center gap-2">
              <Info className="w-6 h-6 text-indigo-600" />
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-50">
                <div className="bg-indigo-100 p-4 rounded-full mb-4">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold mb-2 text-slate-800">1. Upload Examples</h3>
                <p className="text-slate-600">Upload up to 5 previous successful grant proposals as reference material</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-50">
                <div className="bg-indigo-100 p-4 rounded-full mb-4">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold mb-2 text-slate-800">2. Add Requirements</h3>
                <p className="text-slate-600">Specify your new proposal's requirements and goals</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-50">
                <div className="bg-indigo-100 p-4 rounded-full mb-4">
                  <Send className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold mb-2 text-slate-800">3. Generate</h3>
                <p className="text-slate-600">Get an AI-generated proposal based on your inputs</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload Previous Proposals
              </h2>
              <div className="group relative">
                <HelpCircle className="w-5 h-5 text-slate-400 cursor-help" />
                <div className="absolute right-0 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  Accepted formats: .txt and .docx files
                </div>
              </div>
            </div>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center bg-slate-50">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
                accept=".txt,.docx"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Select Files (Max 5)
              </button>
              <p className="text-slate-500 mt-2">Drag and drop files here or click to browse</p>
              {uploadError && (
                <div className="mt-4 text-red-600 bg-red-50 p-3 rounded-lg">
                  {uploadError}
                </div>
              )}
            </div>
            {files.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-slate-800">Selected Files ({files.length}/5):</h3>
                  <button
                    onClick={handleRemoveAllFiles}
                    className="text-slate-600 hover:text-slate-800 text-sm"
                  >
                    Remove All
                  </button>
                </div>
                <ul className="space-y-2">
                  {files.map((file, index) => (
                    <li key={index} className="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="text-slate-700">{file.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Project Details
            </h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-slate-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50"
                  placeholder="Enter project name..."
                />
              </div>
              <div>
                <label htmlFor="requirements" className="block text-sm font-medium text-slate-700 mb-2">
                  Proposal Requirements
                </label>
                <textarea
                  id="requirements"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="w-full h-40 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50"
                  placeholder="Example: Need a grant proposal for a community education program targeting underprivileged youth. Budget requirement: $50,000. Focus areas: STEM education, after-school programs, and mentorship..."
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                {isLoading ? 'Generating Proposal...' : 'Generate Proposal'}
              </button>
            </div>
          </div>

          {projectGroups.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Project History
                </h2>
                <span className="text-slate-500 text-sm">
                  {proposalHistory.length} proposal{proposalHistory.length !== 1 ? 's' : ''} in {projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="space-y-6">
                {projectGroups.map((group) => (
                  <div key={group.projectName} className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleProjectCollapse(group.projectName)}
                      className="w-full px-6 py-4 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {group.isCollapsed ? (
                          <Folder className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <FolderOpen className="w-5 h-5 text-indigo-600" />
                        )}
                        <span className="font-medium text-slate-800">{group.projectName}</span>
                        <span className="text-sm text-slate-500">
                          ({group.proposals.length} proposal{group.proposals.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      {group.isCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    
                    {!group.isCollapsed && (
                      <div className="divide-y divide-slate-200">
                        {group.proposals.map((response) => (
                          <div key={response.id} className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Clock className="w-4 h-4" />
                                {new Date(response.timestamp).toLocaleString()}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopy(response.editedProposal || response.proposal)}
                                  className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-50"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(response)}
                                  className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-50"
                                  title="Download as Markdown"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                {editingProposal !== response.id ? (
                                  <button
                                    onClick={() => handleEdit(response.id)}
                                    className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-50"
                                    title="Edit proposal"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSave(response.id)}
                                    className="text-green-500 hover:text-green-700 p-2 rounded-lg hover:bg-green-50"
                                    title="Save changes"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="mb-4">
                              <h3 className="text-sm font-medium text-slate-700 mb-2">Requirements:</h3>
                              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg text-sm">
                                {response.requirements}
                              </p>
                            </div>
                            
                            <div>
                              <h3 className="text-sm font-medium text-slate-700 mb-2">Generated Proposal:</h3>
                              <div className="prose max-w-none">
                                {editingProposal === response.id ? (
                                  <textarea
                                    ref={editTextareaRef}
                                    className="w-full h-[500px] p-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white font-mono text-sm"
                                    defaultValue={response.editedProposal || response.proposal}
                                  />
                                ) : (
                                  <div className="bg-slate-50 p-4 rounded-lg whitespace-pre-wrap border border-slate-200 text-slate-800">
                                    {response.editedProposal || response.proposal}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={faqRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 scroll-mt-24">
            <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={index} className="border border-slate-200 rounded-lg">
                  <button
                    className="w-full px-6 py-4 flex items-center justify-between text-left"
                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                  >
                    <span className="font-medium text-slate-800">{item.question}</span>
                    {activeFaq === index ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  {activeFaq === index && (
                    <div className="px-6 pb-4 text-slate-600">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div ref={contactRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 scroll-mt-24">
            <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              Contact Us
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-medium text-slate-800">Email</h3>
                  <p className="text-slate-600">kutaninas@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <Phone className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-medium text-slate-800">Phone</h3>
                  <p className="text-slate-600">+31 6 23 44 82 62</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;