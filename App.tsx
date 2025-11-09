
import React, { useState, useCallback, useMemo } from 'react';
import { Company } from './types';
import { fetchCompanyData } from './services/geminiService';
import { UploadIcon, ProcessingIcon, DoneIcon, ErrorIcon, DownloadIcon, ExcelIcon } from './components/icons';

// Declare XLSX to satisfy TypeScript since it's loaded from a CDN.
declare var XLSX: any;

const App: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setError(null);
        setIsComplete(false);
        setCompanies([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                const companyNames = json
                    .map(row => row[0])
                    .filter(name => typeof name === 'string' && name.trim() !== '');

                if (companyNames.length === 0) {
                  throw new Error("No company names found in the first column of the Excel sheet.");
                }

                const companyList: Company[] = companyNames.map((name, index) => ({
                    id: index,
                    name: name.trim(),
                    status: 'pending',
                }));
                setCompanies(companyList);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Failed to parse the Excel file. Please ensure it's a valid .xlsx or .xls file and contains names in the first column.");
            }
        };
        reader.onerror = () => {
             setError("Failed to read the file.");
        }
        reader.readAsArrayBuffer(file);
    };
    
    const processCompanies = useCallback(async () => {
        setIsProcessing(true);
        setIsComplete(false);
        setError(null);
    
        const newCompanies = [...companies];
    
        for (let i = 0; i < newCompanies.length; i++) {
            const company = newCompanies[i];
            
            setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: 'processing' } : c));
    
            try {
                const { data, sources } = await fetchCompanyData(company.name);
                setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: 'done', data: data || undefined, sources } : c));
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
                setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: 'error', error: errorMessage } : c));
            }
        }
    
        setIsProcessing(false);
        setIsComplete(true);
    }, [companies]);

    const downloadExcel = useCallback(() => {
        const dataToExport = companies.map(company => ({
            'Название компании': company.name,
            'Сайт': company.data?.website || 'Нет данных',
            'Описание': company.data?.description || 'Нет данных',
            'Оборот': company.data?.revenue || 'Нет данных',
            'Подтвержденные лаборатории': company.data?.laboratories?.confirmed?.join(', ') || 'Нет',
            'Предполагаемые лаборатории': company.data?.laboratories?.presumed?.join(', ') || 'Нет',
            'Контакты': company.data?.contacts
                ?.map(c => `Имя: ${c.name}, Должность: ${c.title}, Email: ${c.email || 'Не указан'}, Телефон: ${c.phone || 'Не указан'}`)
                .join('\n') || 'Нет',
            'Статус обработки': company.status,
            'Ошибка': company.error || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Enriched Company Data');
        XLSX.writeFile(workbook, `enriched_${fileName || 'data'}.xlsx`);
    }, [companies, fileName]);

    const progress = useMemo(() => {
        if (companies.length === 0) return 0;
        const doneCount = companies.filter(c => c.status === 'done' || c.status === 'error').length;
        return (doneCount / companies.length) * 100;
    }, [companies]);

    return (
        <div className="min-h-screen flex flex-col items-center p-4 sm:p-8">
            <header className="w-full max-w-5xl text-center mb-8">
                <div className="flex justify-center items-baseline flex-wrap gap-x-4 mb-2">
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-light to-brand-secondary">
                        AI Company Data Enricher
                    </h1>
                    <p className="text-slate-500 text-lg italic">by stoklos</p>
                </div>
                <p className="text-slate-400">
                    Загрузите Excel, и ИИ найдет сайты, контакты, лаборатории и многое другое для каждой компании.
                </p>
            </header>

            <main className="w-full max-w-5xl bg-base-200 rounded-2xl shadow-2xl p-6 sm:p-8 flex-grow">
                {error && (
                     <div className="bg-red-900/50 border border-accent-error text-red-200 p-4 rounded-lg mb-6">
                        <strong>Error:</strong> {error}
                    </div>
                )}
                
                {!companies.length && !isProcessing && (
                    <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-base-300 rounded-lg p-12 text-center">
                         <UploadIcon className="w-16 h-16 text-base-300 mb-4"/>
                         <h2 className="text-xl font-semibold mb-2">Перетащите сюда свой Excel файл</h2>
                         <p className="text-slate-400 mb-4">или</p>
                         <label htmlFor="file-upload" className="cursor-pointer bg-brand-primary hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                             Выберите файл
                         </label>
                         <input id="file-upload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </div>
                )}
                
                {companies.length > 0 && (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                           <div className="flex items-center gap-3">
                                <ExcelIcon className="w-8 h-8 text-brand-light" />
                                <span className="font-medium text-lg">{fileName} ({companies.length} companies)</span>
                           </div>
                           {!isProcessing && !isComplete && (
                                <button onClick={processCompanies} className="bg-brand-primary hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors w-full sm:w-auto">
                                   Начать обработку
                                </button>
                           )}
                           {isComplete && (
                                <button onClick={downloadExcel} className="bg-accent-success hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 w-full sm:w-auto">
                                    <DownloadIcon className="w-5 h-5"/>
                                    Скачать готовый файл
                                </button>
                           )}
                        </div>

                         {isProcessing && (
                            <div className="mb-6">
                                <div className="flex justify-between mb-1">
                                    <span className="text-base font-medium text-brand-light">Processing...</span>
                                    <span className="text-sm font-medium text-brand-light">{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full bg-base-300 rounded-full h-2.5">
                                    <div className="bg-brand-secondary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}

                        {isComplete && (
                             <div className="bg-green-900/50 border border-accent-success text-green-200 p-4 rounded-lg mb-6 text-center">
                                Поиск информации завершён, и можно скачать готовый файл!
                            </div>
                        )}

                        <div className="max-h-[50vh] overflow-y-auto pr-2">
                            <ul className="space-y-3">
                                {companies.map(company => (
                                    <li key={company.id} className="bg-base-300/50 p-3 rounded-lg flex items-center justify-between transition-all">
                                        <span className="font-medium truncate pr-4">{company.name}</span>
                                        <div className="flex-shrink-0">
                                            {company.status === 'pending' && <span className="text-slate-500 text-sm">Pending</span>}
                                            {company.status === 'processing' && <ProcessingIcon />}
                                            {company.status === 'done' && <DoneIcon />}
                                            {company.status === 'error' && <ErrorIcon />}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
