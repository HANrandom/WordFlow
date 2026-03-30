import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { 
  BookOpenCheck, 
  Database, 
  RefreshCw, 
  LayoutDashboard, 
  Library, 
  Upload, 
  Settings2, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Trash2, 
  X, 
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Word {
  id?: number;
  word: string;
  meaning: string;
  level: number;
  createdAt: number;
}

interface Level {
  id: number;
  name: string;
}

// --- Main Application ---
export default function App() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevelId, setCurrentLevelId] = useState<number>(0);
  const [activeWord, setActiveWord] = useState<Word | null>(null);
  const [stats, setStats] = useState<Record<number, number>>({});
  const [view, setView] = useState<'main' | 'wordbook'>('main');
  
  // Modals
  const [showLevelsModal, setShowLevelsModal] = useState(false);
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');

  // Pagination
  const [mainPage, setMainPage] = useState(0);
  const [mainPageSize, setMainPageSize] = useState(10);
  const [mainWords, setMainWords] = useState<Word[]>([]);
  const [mainTotal, setMainTotal] = useState(0);

  const [wbPage, setWbPage] = useState(0);
  const [wbPageSize] = useState(20);
  const [wbWords, setWbWords] = useState<Word[]>([]);
  const [wbTotal, setWbTotal] = useState(0);
  const [wbSelectedIds, setWbSelectedIds] = useState<Set<number>>(new Set());
  const [wbCategory, setWbCategory] = useState<number | 'all'>('all');
  const [wbMoveTarget, setWbMoveTarget] = useState<number>(0);
  const [newLevelName, setNewLevelName] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [currentDb, setCurrentDb] = useState<string>('');

  // --- API Calls ---
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchLevels = useCallback(async () => {
    try {
      const res = await fetch('/api/levels');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLevels(data);
      } else {
        console.error('Levels data is not an array:', data);
        setLevels([]);
      }
    } catch (err) {
      console.error('Failed to fetch levels:', err);
      setLevels([]);
    }
  }, []);

  const fetchDatabases = useCallback(async () => {
    try {
      const res = await fetch('/api/databases');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDatabases(data);
      } else {
        setDatabases([]);
      }
    } catch (err) { 
      console.error(err);
      setDatabases([]);
    }
  }, []);

  const fetchCurrentDb = useCallback(async () => {
    try {
      const res = await fetch('/api/databases/current');
      const data = await res.json();
      setCurrentDb(data.current);
    } catch (err) { console.error(err); }
  }, []);

  const fetchMainWords = useCallback(async () => {
    try {
      const res = await fetch(`/api/words?level=${currentLevelId}&page=${mainPage}&pageSize=${mainPageSize}`);
      const data = await res.json();
        if (data && data.words && Array.isArray(data.words)) {
          setMainTotal(data.total || 0);
          setMainWords(data.words);
          
          // Also update active word for learning mode
          if (data.words.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.words.length);
            setActiveWord(data.words[randomIndex]);
          } else {
            setActiveWord(null);
          }
        } else {
          setMainTotal(0);
          setMainWords([]);
          setActiveWord(null);
        }
    } catch (err) {
      console.error('Failed to fetch main words:', err);
      setMainTotal(0);
      setMainWords([]);
      setActiveWord(null);
    }
  }, [currentLevelId, mainPage, mainPageSize]);

  const fetchWbWords = useCallback(async () => {
    try {
      const res = await fetch(`/api/words?level=${wbCategory}&page=${wbPage}&pageSize=${wbPageSize}`);
      const data = await res.json();
        if (data && data.words && Array.isArray(data.words)) {
          setWbTotal(data.total || 0);
          setWbWords(data.words);
        } else {
          setWbTotal(0);
          setWbWords([]);
        }
    } catch (err) {
      console.error('Failed to fetch wordbook words:', err);
      setWbTotal(0);
      setWbWords([]);
    }
  }, [wbCategory, wbPage, wbPageSize]);

  // Load Initial Data
  useEffect(() => {
    fetchLevels();
    fetchStats();
    fetchDatabases();
    fetchCurrentDb();
  }, [fetchLevels, fetchStats, fetchDatabases, fetchCurrentDb]);

  useEffect(() => {
    if (view === 'main') fetchMainWords();
  }, [view, fetchMainWords]);

  useEffect(() => {
    if (view === 'wordbook') fetchWbWords();
  }, [view, fetchWbWords]);

  // --- Data Actions ---
  const updateWordLevel = async (wordId: number, newLevel: number) => {
    try {
      await fetch('/api/words/update_level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wordId, level: newLevel })
      });
      fetchStats();
      fetchMainWords();
    } catch (err) {
      console.error('Failed to update word level:', err);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: async (results) => {
        const data = results.data as string[][];
        if (!data || data.length === 0) return alert('文件内容为空');

        const newWords: Word[] = [];
        const startIndex = (data[0][0]?.toLowerCase().includes('word')) ? 1 : 0;

        for (let i = startIndex; i < data.length; i++) {
          const row = data[i];
          if (row && row.length >= 2) {
            const word = row[0]?.trim();
            const meaning = row[1]?.trim();
            if (word && meaning) {
              newWords.push({ word, meaning, level: 0, createdAt: Date.now() });
            }
          }
        }

        if (newWords.length > 0) {
          try {
            await fetch('/api/words/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newWords)
            });
            alert(`成功导入 ${newWords.length} 个单词`);
            fetchStats();
            fetchMainWords();
            if (view === 'wordbook') fetchWbWords();
          } catch (err) {
            console.error(err);
            alert('导入失败');
          }
        }
      }
    });
    e.target.value = '';
  };

  const handleBatchDelete = async () => {
    if (wbSelectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${wbSelectedIds.size} 个单词吗？`)) return;
    try {
      await fetch('/api/words/batch_delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(wbSelectedIds) })
      });
      setWbSelectedIds(new Set());
      fetchStats();
      fetchWbWords();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchMove = async (targetLevel: number) => {
    if (wbSelectedIds.size === 0) return;
    try {
      await fetch('/api/words/batch_move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(wbSelectedIds), level: targetLevel })
      });
      setWbSelectedIds(new Set());
      fetchStats();
      fetchWbWords();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLevel = async () => {
    if (!newLevelName.trim()) return;
    try {
      await fetch('/api/levels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLevelName })
      });
      setNewLevelName('');
      fetchLevels();
    } catch (err) { console.error(err); }
  };

  const handleUpdateLevel = async (id: number, name: string) => {
    try {
      await fetch('/api/levels/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name })
      });
      fetchLevels();
    } catch (err) { console.error(err); }
  };

  const handleDeleteLevel = async (id: number) => {
    if (id === 0) return alert('默认等级不可删除');
    if (!confirm('删除等级会将该等级下的所有单词移回"未筛选"，确定吗？')) return;
    try {
      await fetch('/api/levels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (currentLevelId === id) setCurrentLevelId(0);
      fetchLevels();
      fetchStats();
      fetchMainWords();
    } catch (err) { console.error(err); }
  };

  const handleExport = async (format: 'csv' | 'txt') => {
    try {
      const res = await fetch(`/api/words?level=${wbCategory}&page=0&pageSize=100000`);
      const data = await res.json();
      const words = data.words as Word[];
      
      let content = '';
      let filename = `wordflow_export_${new Date().getTime()}`;

      if (format === 'csv') {
        content = Papa.unparse(words.map(w => [w.word, w.meaning]));
        filename += '.csv';
      } else {
        content = words.map(w => `${w.word}\t${w.meaning}`).join('\n');
        filename += '.txt';
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const handleCreateDb = async () => {
    if (!newDbName.trim()) return;
    try {
      await fetch('/api/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDbName })
      });
      setNewDbName('');
      setShowCreateDbModal(false);
      fetchDatabases();
      fetchCurrentDb();
      fetchLevels();
      fetchStats();
      fetchMainWords();
    } catch (err) { console.error(err); }
  };

  const handleSwitchDb = async (name: string) => {
    try {
      await fetch('/api/databases/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      fetchCurrentDb();
      fetchLevels();
      fetchStats();
      fetchMainWords();
      if (view === 'wordbook') fetchWbWords();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="bg-[#f8f9fa] min-h-screen flex flex-col text-[#3c4043] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
                <BookOpenCheck className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">WordFlow Desktop</h1>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <button 
                onClick={() => setShowCreateDbModal(true)}
                className="flex items-center gap-2 text-sm text-gray-600 px-1 hover:text-blue-600 transition-colors"
              >
                <Database className="w-4 h-4 text-blue-500" />
                <span className="font-bold truncate max-w-[100px]">{currentDb || 'Loading...'}</span>
              </button>
              <div className="h-4 w-px bg-gray-300 mx-1"></div>
              <button 
                onClick={() => setShowLevelsModal(true)}
                className="text-gray-400 hover:text-blue-600 transition-colors p-1.5 hover:bg-white rounded-md"
                title="管理等级"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => { fetchStats(); fetchMainWords(); }}
                className="text-gray-400 hover:text-blue-600 transition-colors p-1.5 hover:bg-white rounded-md"
                title="刷新数据"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <nav className="flex h-full">
              <button 
                onClick={() => setView('main')}
                className={cn(
                  "px-6 h-full flex items-center gap-2 font-semibold text-sm transition-all border-b-2",
                  view === 'main' ? "text-blue-600 border-blue-600 bg-blue-50/30" : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                主界面
              </button>
              <button 
                onClick={() => setView('wordbook')}
                className={cn(
                  "px-6 h-full flex items-center gap-2 font-semibold text-sm transition-all border-b-2",
                  view === 'wordbook' ? "text-blue-600 border-blue-600 bg-blue-50/30" : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Library className="w-4 h-4" />
                单词簿
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <motion.div 
              key="main"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                  <div className="flex-1">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">筛选等级</h2>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(levels) && levels.map(lvl => (
                        <button
                          key={lvl.id}
                          onClick={() => { setCurrentLevelId(lvl.id); setMainPage(0); }}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                            currentLevelId === lvl.id 
                              ? "bg-blue-600 text-white shadow-md scale-105" 
                              : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                          )}
                        >
                          {lvl.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:text-right">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">词库统计</h2>
                    <div className="flex flex-wrap md:justify-end gap-4">
                      {Array.isArray(levels) && levels.map(lvl => (
                        <div key={lvl.id} className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          {lvl.name}: <span className="text-blue-600">{stats[lvl.id] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-100">
                  <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-sm active:scale-95">
                    <Upload className="w-4 h-4 text-blue-500" />
                    导入单词 (CSV)
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                  </label>
                </div>
              </section>

              <section className="relative min-h-[320px]">
                <AnimatePresence mode="wait">
                  {!activeWord ? (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-20 text-center flex flex-col items-center justify-center h-full min-h-[320px]"
                    >
                      <Sparkles className="w-16 h-16 text-gray-200 mb-6" />
                      <p className="text-gray-400 text-xl font-medium">当前等级暂无单词，换个等级试试？</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key={activeWord.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-white rounded-3xl border border-gray-200 p-12 shadow-xl text-center relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600/10" />
                      <div className="mb-4">
                        <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                          Learning Mode
                        </span>
                      </div>
                      <h2 className="text-7xl font-black text-gray-900 mb-6 tracking-tight">{activeWord.word}</h2>
                      <p className="text-2xl text-gray-400 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
                        {activeWord.meaning}
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-3">
                        {Array.isArray(levels) && levels.filter(l => l.id !== 0).map(lvl => (
                          <button
                            key={lvl.id}
                            onClick={() => updateWordLevel(activeWord.id!, lvl.id)}
                            className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-700 font-bold rounded-2xl hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all hover:shadow-lg active:scale-95"
                          >
                            {lvl.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">当前等级词汇预览</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <span>每页</span>
                      <input 
                        type="number" 
                        value={mainPageSize} 
                        onChange={(e) => setMainPageSize(Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-center font-bold" 
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        disabled={mainPage === 0}
                        onClick={() => setMainPage(p => p - 1)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black min-w-[60px] text-center text-gray-600">
                        {mainPage + 1} / {Math.ceil(mainTotal / mainPageSize) || 1}
                      </span>
                      <button 
                        disabled={(mainPage + 1) * mainPageSize >= mainTotal}
                        onClick={() => setMainPage(p => p + 1)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {mainWords.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-sm font-medium">暂无数据</div>
                  ) : (
                    mainWords.map((w, idx) => (
                      <div key={w.id} className="px-6 py-4 flex items-center hover:bg-gray-50 transition-colors group">
                        <span className="w-8 text-xs font-bold text-gray-300 group-hover:text-blue-300 transition-colors">
                          {mainPage * mainPageSize + idx + 1}
                        </span>
                        <div className="flex-1 flex items-baseline gap-4">
                          <span className="text-lg font-bold text-gray-900">{w.word}</span>
                          <span className="text-sm text-gray-400 font-medium">{w.meaning}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {Array.isArray(levels) && levels.filter(l => l.id !== currentLevelId).map(lvl => (
                            <button
                              key={lvl.id}
                              onClick={() => updateWordLevel(w.id!, lvl.id)}
                              className="px-2 py-1 text-[10px] font-black bg-white border border-gray-200 text-gray-400 rounded hover:border-blue-500 hover:text-blue-500 transition-all"
                            >
                              {lvl.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div 
              key="wordbook"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">选择分类</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setWbCategory('all'); setWbPage(0); }}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                      wbCategory === 'all' 
                        ? "bg-blue-600 text-white shadow-md" 
                        : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                    )}
                  >
                    全部词汇 ({Object.values(stats).reduce((a: number, b: number) => a + b, 0)})
                  </button>
                    {Array.isArray(levels) && levels.map(lvl => (
                      <button
                        key={lvl.id}
                        onClick={() => { setWbCategory(lvl.id); setWbPage(0); }}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                          wbCategory === lvl.id 
                            ? "bg-blue-600 text-white shadow-md" 
                            : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                        )}
                      >
                        {lvl.name} ({stats[lvl.id] || 0})
                      </button>
                    ))}
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={wbWords.length > 0 && wbWords.every(w => wbSelectedIds.has(w.id!))}
                        onChange={(e) => {
                          const newSelected = new Set(wbSelectedIds);
                          if (e.target.checked) {
                            wbWords.forEach(w => newSelected.add(w.id!));
                          } else {
                            wbWords.forEach(w => newSelected.delete(w.id!));
                          }
                          setWbSelectedIds(newSelected);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      全选
                    </label>
                    <button 
                      onClick={handleBatchDelete}
                      disabled={wbSelectedIds.size === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-black transition-all disabled:opacity-30 active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      批量删除 ({wbSelectedIds.size})
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <button 
                        disabled={wbPage === 0}
                        onClick={() => setWbPage(p => p - 1)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black min-w-[60px] text-center text-gray-600">
                        {wbPage + 1} / {Math.ceil(wbTotal / wbPageSize) || 1}
                      </span>
                      <button 
                        disabled={(wbPage + 1) * wbPageSize >= wbTotal}
                        onClick={() => setWbPage(p => p + 1)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleExport('csv')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-black transition-all active:scale-95"
                      >
                        导出 CSV
                      </button>
                      <button 
                        onClick={() => handleExport('txt')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-black transition-all active:scale-95"
                      >
                        导出 TXT
                      </button>
                      <div className="h-4 w-px bg-gray-300 mx-2"></div>
                      <select 
                        value={wbMoveTarget}
                        onChange={(e) => setWbMoveTarget(Number(e.target.value))}
                        className="bg-gray-100 text-xs font-bold border-none rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer px-3 py-1.5"
                      >
                        {Array.isArray(levels) && levels.map(lvl => (
                          <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => handleBatchMove(wbMoveTarget)}
                        disabled={wbSelectedIds.size === 0}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-black hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-30"
                      >
                        批量移动
                      </button>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {wbWords.length === 0 ? (
                    <div className="p-20 text-center text-gray-400 text-sm font-medium">暂无数据</div>
                  ) : (
                    wbWords.map((w) => (
                      <div key={w.id} className="px-6 py-4 flex items-center hover:bg-gray-50 transition-colors group">
                        <input 
                          type="checkbox" 
                          checked={wbSelectedIds.has(w.id!)}
                          onChange={(e) => {
                            const newSelected = new Set(wbSelectedIds);
                            if (e.target.checked) newSelected.add(w.id!);
                            else newSelected.delete(w.id!);
                            setWbSelectedIds(newSelected);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-6" 
                        />
                        <div className="flex-1 flex items-baseline gap-4">
                          <span className="text-lg font-bold text-gray-900">{w.word}</span>
                          <span className="text-sm text-gray-400 font-medium">{w.meaning}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-wider">
                            {Array.isArray(levels) && levels.find(l => l.id === w.level)?.name}
                          </span>
                          <button 
                            onClick={async () => {
                              if (confirm('确定删除吗？')) {
                                try {
                                  await fetch('/api/words/batch_delete', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ids: [w.id] })
                                  });
                                  fetchStats();
                                  fetchWbWords();
                                } catch (err) { console.error(err); }
                              }
                            }}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            WordFlow Desktop Edition • Powered by Python & React
          </p>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showLevelsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLevelsModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-900">管理学习等级</h3>
                <button onClick={() => setShowLevelsModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {Array.isArray(levels) && levels.map(lvl => (
                  <div key={lvl.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group">
                    <input 
                      type="text"
                      value={lvl.name}
                      onChange={(e) => {
                        const newLevels = Array.isArray(levels) ? levels.map(l => l.id === lvl.id ? { ...l, name: e.target.value } : l) : [];
                        setLevels(newLevels);
                      }}
                      onBlur={(e) => handleUpdateLevel(lvl.id, e.target.value)}
                      className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-gray-700"
                    />
                    {lvl.id !== 0 && (
                      <button 
                        onClick={() => handleDeleteLevel(lvl.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-4">
                  <input 
                    type="text"
                    placeholder="新等级名称..."
                    value={newLevelName}
                    onChange={(e) => setNewLevelName(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    onClick={handleAddLevel}
                    className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => setShowLevelsModal(false)}
                  className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-black rounded-2xl hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                >
                  完成
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCreateDbModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateDbModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-900">切换/新建数据库</h3>
                <button onClick={() => setShowCreateDbModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">现有数据库</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.isArray(databases) && databases.map(dbName => (
                      <button
                        key={dbName}
                        onClick={() => handleSwitchDb(dbName)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-bold border transition-all truncate",
                          currentDb === dbName 
                            ? "bg-blue-50 border-blue-200 text-blue-600" 
                            : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                        )}
                      >
                        {dbName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">新建数据库</h4>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="数据库名称..."
                      value={newDbName}
                      onChange={(e) => setNewDbName(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                      onClick={handleCreateDb}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      创建
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
