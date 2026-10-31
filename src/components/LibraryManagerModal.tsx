// ============================================================================
// APEXROCK ARDUINODROID: COMPLETE LIBRARY MANAGER MODAL
// ArduinoDroid Built-in & Custom Library Manager, Header Injector & Example Loader
// ============================================================================

import React, { useState } from 'react';
import { ARDUINO_DROID_LIBRARIES, ArduinoLibrary } from '../services/arduinoDroidLibraries';
import { hardwareAudio } from '../services/audioSynthesizer';
import { Search, BookOpen, Plus, Check, Download, ExternalLink, X, Code2 } from 'lucide-react';

interface LibraryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncludeHeader: (headerCode: string) => void;
  onLoadExample: (exampleCode: string, exampleTitle: string) => void;
}

export const LibraryManagerModal: React.FC<LibraryManagerModalProps> = ({
  isOpen,
  onClose,
  onIncludeHeader,
  onLoadExample
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [libraryList, setLibraryList] = useState<ArduinoLibrary[]>(ARDUINO_DROID_LIBRARIES);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ['All', 'Communication', 'Sensors', 'Actuators & Display', 'Robotics & Control', 'Data & Utility'];

  const filteredLibraries = libraryList.filter(lib => {
    const matchesCategory = selectedCategory === 'All' || lib.category === selectedCategory;
    const matchesSearch = lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          lib.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          lib.headers.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleInclude = (lib: ArduinoLibrary) => {
    hardwareAudio.playClick(1100);
    const headerBlock = lib.headers.join('\n');
    onIncludeHeader(headerBlock);
    setNotification(`Inserted ${lib.headers[0]} into sketch`);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleOpenExample = (lib: ArduinoLibrary) => {
    hardwareAudio.playClick(1200);
    onLoadExample(lib.exampleSketch.code, lib.exampleSketch.title);
    onClose();
  };

  const handleToggleInstall = (libId: string) => {
    hardwareAudio.playClick(900);
    setLibraryList(prev => prev.map(l => l.id === libId ? { ...l, installed: !l.installed } : l));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-black border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] text-neutral-100 font-sans">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                ArduinoDroid Library Manager
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                {libraryList.length} Core Libraries Available · C++ Header Repository
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-neutral-800 bg-black flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search libraries (e.g. 'WiFi', 'NewPing', 'Servo', 'SSD1306', 'Dabble')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 outline-none focus:border-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  hardwareAudio.playClick(900);
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-white text-black'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-700 text-xs text-emerald-400 font-mono flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{notification}</span>
          </div>
        )}

        {/* Library List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black">
          {filteredLibraries.map(lib => (
            <div
              key={lib.id}
              className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-neutral-700 transition-colors"
            >
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    {lib.name}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                    v{lib.version}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    by {lib.author}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {lib.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {lib.headers.map((h, i) => (
                    <code key={i} className="text-[11px] font-mono text-neutral-300 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                      {h}
                    </code>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleInclude(lib)}
                  className="px-3 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Include</span>
                </button>

                <button
                  onClick={() => handleOpenExample(lib)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-200 text-black rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Open Example</span>
                </button>
              </div>
            </div>
          ))}

          {filteredLibraries.length === 0 && (
            <div className="py-12 text-center text-xs text-neutral-500 font-mono">
              No libraries found matching "{searchQuery}".
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>ArduinoDroid v6.0 Library Engine · ESP-IDF & AVR Toolchain</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-semibold transition-colors border border-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
