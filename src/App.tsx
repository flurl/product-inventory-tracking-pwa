import { useState, useEffect, useRef } from "react";

interface Product {
  id: string;
  name: string;
  packagingSize: number;
  sortIndex?: number;
}

interface CountItem {
  productId: string;
  productName: string;
  packagingSize: number;
  packageCount: number;
  singleCount: number;
}

interface SavedCount {
  id: string;
  formName: string;
  timestamp: string;
  items: CountItem[];
}

interface FormTemplate {
  id: string;
  name: string;
  products: Product[];
  createdAt: string;
}

type View = "start" | "import" | "create-template" | "count" | "view-counts";

export function App() {
  const [view, setView] = useState<View>("start");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [savedCounts, setSavedCounts] = useState<SavedCount[]>([]);
  const [currentForm, setCurrentForm] = useState<FormTemplate | null>(null);
  const [currentCounts, setCurrentCounts] = useState<CountItem[]>([]);
  const [importError, setImportError] = useState<string>("");
  const [newTemplateName, setNewTemplateName] = useState<string>("");
  const [newTemplateProducts, setNewTemplateProducts] = useState<Product[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // persistent counting session state
  const [resumeSessionDialogOpen, setResumeSessionDialogOpen] = useState(false);
  const sessionRecovered = useRef(false);

  // long-press dialog state
  const longPressStart = useRef<number | null>(null);
  const [numberDialogOpen, setNumberDialogOpen] = useState(false);
  const [numberDialogProduct, setNumberDialogProduct] = useState<{ productId: string; field: "single" | "package"; sign: 1 | -1 } | null>(null);
  const [numberDialogValue, setNumberDialogValue] = useState<string>("");

  // Load data from localStorage on mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem("productCounter_templates");
    const savedCountsData = localStorage.getItem("productCounter_counts");
    const savedSession = localStorage.getItem("productCounter_session");
    
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    }
    if (savedCountsData) {
      try {
        const parsed = JSON.parse(savedCountsData) as SavedCount[];
        // migrate old saved items that had a single "count" value into packageCount/singleCount
        const migrated = parsed.map(sc => ({
          ...sc,
          items: sc.items.map(it => {
            const anyIt = it as any;
            if (anyIt.packageCount !== undefined && anyIt.singleCount !== undefined) {
              return { ...anyIt };
            }
            // fallback: if legacy 'count' exists, split into packages + singles using packagingSize
            const packagingSize = anyIt.packagingSize || 1;
            const total = Number(anyIt.count ?? 0);
            const packageCount = Math.floor(total / packagingSize);
            const singleCount = total % packagingSize;
            return {
              productId: anyIt.productId,
              productName: anyIt.productName,
              packagingSize,
              packageCount,
              singleCount,
            };
          }),
        }));
        setSavedCounts(migrated);
      } catch {
        setSavedCounts([]);
      }
    }
    
    // check for active session to resume
    if (savedSession && !sessionRecovered.current) {
      try {
        const session = JSON.parse(savedSession) as { form: FormTemplate; counts: CountItem[] };
        setCurrentForm(session.form);
        setCurrentCounts(session.counts);
        setResumeSessionDialogOpen(true);
        sessionRecovered.current = true;
      } catch {
        localStorage.removeItem("productCounter_session");
      }
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem("productCounter_templates", JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem("productCounter_counts", JSON.stringify(savedCounts));
  }, [savedCounts]);

  // Save active session to localStorage
  useEffect(() => {
    if (currentForm && currentCounts.length > 0) {
      const session = { form: currentForm, counts: currentCounts };
      localStorage.setItem("productCounter_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("productCounter_session");
    }
  }, [currentForm, currentCounts]);

  // Parse CSV file
  const parseCSV = (text: string): Product[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    const products: Product[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Handle quoted CSV values
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current);
      
      // Trim quotes from values
      const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ""));
      
      if (cleanValues.length >= 3) {
        const packagingSize = parseFloat(cleanValues[2]);
        if (isNaN(packagingSize)) {
          throw new Error(`Invalid packaging size at row ${i + 1}: "${cleanValues[2]}"`);
        }
        
        products.push({
          id: cleanValues[0],
          name: cleanValues[1],
          packagingSize,
          sortIndex: cleanValues[3] ? parseInt(cleanValues[3]) : undefined,
        });
      }
    }
    
    // Sort by sortIndex if available
    return products.sort((a, b) => {
      const aIndex = a.sortIndex ?? Infinity;
      const bIndex = b.sortIndex ?? Infinity;
      return aIndex - bIndex;
    });
  };

  // Handle CSV file import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const products = parseCSV(text);
      
      if (products.length === 0) {
        setImportError("No valid products found in the CSV file");
        return;
      }

      const template: FormTemplate = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        products,
        createdAt: new Date().toISOString(),
      };

      setTemplates(prev => [...prev, template]);
      setImportError("");
      setSuccessMessage(`Successfully imported ${products.length} products from "${file.name}"`);
      
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Error parsing CSV file");
    }

    // Reset file input
    event.target.value = "";
  };

  // Add new product to template
  const addProductToTemplate = () => {
    const id = prompt("Enter Product ID:");
    if (!id) return;
    
    const name = prompt("Enter Product Name:");
    if (!name) return;
    
    const packagingSizeStr = prompt("Enter Packaging Size:");
    if (!packagingSizeStr) return;
    
    const packagingSize = parseFloat(packagingSizeStr);
    if (isNaN(packagingSize) || packagingSize <= 0) {
      alert("Invalid packaging size");
      return;
    }

    const sortIndexStr = prompt("Enter Sort Index (optional, leave empty for none):");
    const sortIndex = sortIndexStr ? parseInt(sortIndexStr) : undefined;

    setNewTemplateProducts(prev => [...prev, { id, name, packagingSize, sortIndex }]);
  };

  // Save new template
  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    if (newTemplateProducts.length === 0) {
      alert("Please add at least one product");
      return;
    }

    const template: FormTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      products: [...newTemplateProducts].sort((a, b) => {
        const aIndex = a.sortIndex ?? Infinity;
        const bIndex = b.sortIndex ?? Infinity;
        return aIndex - bIndex;
      }),
      createdAt: new Date().toISOString(),
    };

    setTemplates(prev => [...prev, template]);
    setNewTemplateName("");
    setNewTemplateProducts([]);
    setSuccessMessage(`Template "${template.name}" saved successfully`);
    setTimeout(() => setSuccessMessage(""), 3000);
    setView("start");
  };

  // Start counting from selected template
  const startCounting = () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    setCurrentForm(template);
    setCurrentCounts(
      template.products.map(p => ({
        productId: p.id,
        productName: p.name,
        packagingSize: p.packagingSize,
        packageCount: 0,
        singleCount: 0,
      }))
    );
    setView("count");
  };

  // Update single item count for a product
  const updateSingleCount = (productId: string, delta: number) => {
    setCurrentCounts(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newSingle = Math.max(0, item.singleCount + delta);
          return { ...item, singleCount: newSingle };
        }
        return item;
      })
    );
  };

  // Update package count for a product
  const updatePackageCount = (productId: string, delta: number) => {
    setCurrentCounts(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newPackages = Math.max(0, item.packageCount + delta);
          return { ...item, packageCount: newPackages };
        }
        return item;
      })
    );
  };

  // long-press helpers
  const openNumberDialogFor = (productId: string, field: "single" | "package", sign: 1 | -1) => {
    setNumberDialogProduct({ productId, field, sign });
    setNumberDialogValue("");
    setNumberDialogOpen(true);
  };

  const handleNumberDialogSubmit = () => {
    if (!numberDialogProduct) return;
    const n = parseInt(numberDialogValue || "0", 10);
    if (isNaN(n) || n === 0) {
      setNumberDialogOpen(false);
      return;
    }
    const delta = numberDialogProduct.sign * n;
    if (numberDialogProduct.field === "single") {
      updateSingleCount(numberDialogProduct.productId, delta);
    } else {
      updatePackageCount(numberDialogProduct.productId, delta);
    }
    setNumberDialogOpen(false);
  };

  const handleCountButtonDown = (productId: string, field: "single" | "package", sign: 1 | -1) => {
    longPressStart.current = Date.now();
  };

  const handleCountButtonUp = (productId: string, field: "single" | "package", sign: 1 | -1) => {
    if (!longPressStart.current) return;
    const duration = Date.now() - longPressStart.current;
    longPressStart.current = null;

    if (duration >= 600) {
      // Long press: open dialog
      openNumberDialogFor(productId, field, sign);
    } else {
      // Short press: execute action
      if (field === "single") {
        updateSingleCount(productId, sign);
      } else {
        updatePackageCount(productId, sign);
      }
    }
  };

  const getTotal = (item: CountItem) => item.packageCount * item.packagingSize + item.singleCount;

  // Submit count
  const submitCount = () => {
    if (!currentForm) return;

    const savedCount: SavedCount = {
      id: Date.now().toString(),
      formName: currentForm.name,
      timestamp: new Date().toISOString(),
      items: [...currentCounts],
    };

    setSavedCounts(prev => [savedCount, ...prev]);
    setSuccessMessage("Count submitted successfully!");
    setTimeout(() => setSuccessMessage(""), 3000);
    setView("start");
    setCurrentForm(null);
    setCurrentCounts([]);
  };

  // Export count as CSV
  const exportCount = (count: SavedCount) => {
    const date = new Date(count.timestamp);
    const dateStr = date
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    
    const filename = `${count.formName}_${dateStr}.csv`;
    
    let csv = "Product ID,Product Name,Packaging Size,Package Count,Single Count,Total\n";
    count.items.forEach(item => {
      const total = getTotal(item);
      csv += `${item.productId},${item.productName},${item.packagingSize},${item.packageCount},${item.singleCount},${total}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Share count via Web Share API
  const shareCount = async (count: SavedCount) => {
    const date = new Date(count.timestamp);
    const dateStr = date
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    
    const filename = `${count.formName}_${dateStr}.csv`;
    
    let csv = "Product ID,Product Name,Packaging Size,Package Count,Single Count,Total\n";
    count.items.forEach(item => {
      const total = getTotal(item);
      csv += `${item.productId},${item.productName},${item.packagingSize},${item.packageCount},${item.singleCount},${total}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const file = new File([blob], filename, { type: "text/csv" });

    if (navigator.share) {
      try {
        await navigator.share({
          files: [file],
          title: count.formName,
          text: `Count results from ${formatDateTime(count.timestamp)}`,
        });
      } catch (error) {
        if (error instanceof Error && error.message !== "Share cancelled") {
          console.error("Share failed:", error);
        }
      }
    } else {
      alert("Web Share API is not supported on this device. Please use Export CSV instead.");
    }
  };

  // Delete template
  const deleteTemplate = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  // Delete saved count
  const deleteSavedCount = (id: string) => {
    if (confirm("Are you sure you want to delete this count?")) {
      setSavedCounts(prev => prev.filter(c => c.id !== id));
    }
  };

  // Format datetime for display
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const handleResumeSession = (resume: boolean) => {
    setResumeSessionDialogOpen(false);
    if (resume) {
      setView("count");
    } else {
      setCurrentForm(null);
      setCurrentCounts([]);
      setView("start");
      localStorage.removeItem("productCounter_session");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-center">
            {successMessage}
          </div>
        )}

        {/* Start Screen */}
        {view === "start" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setView("import")}
                className="group flex items-center justify-start gap-6 rounded-xl bg-white py-6 px-5 shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-indigo-300 text-lg"
              >
                <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Import CSV</div>
                  <div className="text-sm text-slate-500">Import a CSV file to create a form</div>
                </div>
              </button>

              <button
                onClick={() => setView("create-template")}
                className="group flex items-center justify-start gap-6 rounded-xl bg-white py-6 px-5 shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-purple-300 text-lg"
              >
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Create Template</div>
                  <div className="text-sm text-slate-500">Manually create a new form template</div>
                </div>
              </button>

              <button
                onClick={() => {
                   if (templates.length === 0) {
                     alert("No templates available. Please import a CSV or create a template first.");
                     return;
                   }
                   setView("count");
                 }}
                className="group flex items-center justify-start gap-6 rounded-xl bg-white py-6 px-5 shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-emerald-300 text-lg"
              >
                <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Start Counting</div>
                  <div className="text-sm text-slate-500">Count products from existing templates</div>
                </div>
              </button>

              <button
                onClick={() => setView("view-counts")}
                className="group flex items-center justify-start gap-6 rounded-xl bg-white py-6 px-5 shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-amber-300 text-lg"
              >
                <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">View Counts</div>
                  <div className="text-sm text-slate-500">View and share previous counts</div>
                </div>
              </button>
            </div>

            {/* Templates Summary */}
            {templates.length > 0 && (
              <div className="mt-6 rounded-xl bg-white p-6 shadow-sm border border-slate-200">
                <h2 className="font-semibold text-slate-900 mb-3">Available Templates ({templates.length})</h2>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="text-sm text-slate-500">{t.products.length} products • Created {formatDateTime(t.createdAt)}</div>
                      </div>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                        title="Delete template"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Import Screen */}
        {view === "import" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Import CSV File</h2>
              <p className="text-slate-500 mb-4">
                CSV format: Column 1 = Product ID, Column 2 = Product Name, Column 3 = Packaging Size, Column 4 = Sort Index (optional)
              </p>
              
              <label className="block">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileImport}
                  className="hidden"
                  id="csv-input"
                />
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                  <svg className="h-12 w-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-slate-600">Click to select CSV file</span>
                </div>
              </label>

              {importError && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
                  {importError}
                </div>
              )}
            </div>

            <button
              onClick={() => setView("start")}
              className="w-full rounded-xl bg-slate-100 py-4 font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Back to Start
            </button>
          </div>
        )}

        {/* Create Template Screen */}
        {view === "create-template" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Create New Template</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    placeholder="Enter template name..."
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Products</label>
                    <button
                      onClick={addProductToTemplate}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      + Add Product
                    </button>
                  </div>
                  
                  {newTemplateProducts.length === 0 ? (
                    <div className="rounded-lg bg-slate-50 p-4 text-center text-slate-500">
                      No products added yet
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {newTemplateProducts.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                          <div>
                            <div className="font-medium text-slate-900">{p.name}</div>
                            <div className="text-sm text-slate-500">
                              ID: {p.id} • Size: {p.packagingSize}
                              {p.sortIndex !== undefined && ` • Sort: ${p.sortIndex}`}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setNewTemplateProducts(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setNewTemplateName("");
                  setNewTemplateProducts([]);
                  setView("start");
                }}
                className="flex-1 rounded-lg bg-slate-100 py-4 font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                className="flex-1 rounded-xl bg-indigo-600 py-4 font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        )}

        {/* Count Screen */}
        {view === "count" && (
          <div className="space-y-6">
            {!currentForm ? (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Select Template to Count</h2>
                
                {templates.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
                    No templates available. Please import a CSV or create a template first.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <select
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    >
                      <option value="">Select a template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.products.length} products)
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={startCounting}
                      disabled={!selectedTemplateId}
                      className="w-full rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Start Counting
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-900">{currentForm.name}</h2>
                    <span className="text-sm text-slate-500">
                      {currentCounts.filter(c => c.packageCount > 0 || c.singleCount > 0).length} / {currentCounts.length} counted
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {currentCounts.map(item => (
                      <div key={item.productId} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium text-slate-900">{item.productName}</div>
                            <div className="text-sm text-slate-500">
                              ID: {item.productId} • Size: {item.packagingSize}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-indigo-600">
                              {item.packageCount} 𐄹 + {item.singleCount} = {getTotal(item)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-3xl">
                          <button
                            onPointerDown={() => handleCountButtonDown(item.productId, "single", 1)}
                            onPointerUp={() => handleCountButtonUp(item.productId, "single", 1)}
                            className="rounded-xl bg-green-100 py-3 font-medium text-green-700 hover:bg-green-200 transition-colors touch-manipulation"
                          >
                            +1
                          </button>
                          <button
                            onPointerDown={() => handleCountButtonDown(item.productId, "single", -1)}
                            onPointerUp={() => handleCountButtonUp(item.productId, "single", -1)}
                            className="rounded-xl bg-red-100 py-3 font-medium text-red-700 hover:bg-red-200 transition-colors touch-manipulation"
                          >
                            -1
                          </button>
                          <button
                            onPointerDown={() => handleCountButtonDown(item.productId, "package", 1)}
                            onPointerUp={() => handleCountButtonUp(item.productId, "package", 1)}
                            className="rounded-xl bg-emerald-100 py-3 font-medium text-emerald-700 hover:bg-emerald-200 transition-colors touch-manipulation"
                          >
                            +{item.packagingSize}
                          </button>
                          <button
                            onPointerDown={() => handleCountButtonDown(item.productId, "package", -1)}
                            onPointerUp={() => handleCountButtonUp(item.productId, "package", -1)}
                            className="rounded-xl bg-orange-100 py-3 font-medium text-orange-700 hover:bg-orange-200 transition-colors touch-manipulation"
                          >
                            -{item.packagingSize}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setCurrentForm(null);
                      setCurrentCounts([]);
                    }}
                    className="flex-1 rounded-lg bg-slate-100 py-4 font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitCount}
                    className="flex-1 rounded-xl bg-indigo-600 py-4 font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    Submit Count
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* View Counts Screen */}
        {view === "view-counts" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Previous Counts</h2>
              
              {savedCounts.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-6 text-center text-slate-500">
                  No counts saved yet
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {savedCounts.map(count => (
                    <div key={count.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-slate-900">{count.formName}</div>
                          <div className="text-sm text-slate-500">{formatDateTime(count.timestamp)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => exportCount(count)}
                            className="rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 transition-colors"
                            title="Export as CSV"
                          >
                            Export CSV
                          </button>
                          <button
                            onClick={() => shareCount(count)}
                            className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors"
                            title="Share CSV file"
                          >
                            Share
                          </button>
                          <button
                            onClick={() => deleteSavedCount(count.id)}
                            className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {count.items
                            .filter(item => item.packageCount > 0 || item.singleCount > 0)
                            .map((item, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-slate-600">{item.productName}</span>
                                <span className="font-medium text-slate-900">
                                  {item.packageCount} packages + {item.singleCount} single = {getTotal(item)}
                                </span>
                              </div>
                            ))}
                        </div>
                        {count.items.filter(item => item.packageCount > 0 || item.singleCount > 0).length === 0 && (
                          <div className="text-sm text-slate-500 text-center">No items counted</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setView("start")}
              className="w-full rounded-xl bg-slate-100 py-4 font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Back to Start
            </button>
          </div>
        )}

        {numberDialogOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center">
             <div className="absolute inset-0 bg-black/40" onClick={() => setNumberDialogOpen(false)} />
             <div className="relative w-[320px] rounded-lg bg-white p-4 shadow-lg">
               <div className="mb-2 font-semibold">Enter amount</div>
               <input
                 autoFocus
                 value={numberDialogValue}
                 onChange={e => setNumberDialogValue(e.target.value.replace(/[^\d-]/g, ""))}
                 placeholder="Enter positive integer"
                className="w-full rounded border px-3 py-2 mb-3 text-lg"
               />
               <div className="flex gap-2">
                 <button onClick={() => setNumberDialogOpen(false)} className="flex-1 rounded bg-slate-100 py-2">Cancel</button>
                 <button onClick={handleNumberDialogSubmit} className="flex-1 rounded bg-indigo-600 text-white py-2">Apply</button>
               </div>
             </div>
           </div>
         )}

        {resumeSessionDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => handleResumeSession(false)} />
            <div className="relative w-[340px] rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-4 font-semibold text-lg">Resume Counting?</div>
              <p className="text-slate-600 mb-6">You have an active counting session. Do you want to continue?</p>
              <div className="flex gap-3">
                <button onClick={() => handleResumeSession(false)} className="flex-1 rounded-lg bg-slate-100 py-3 font-medium text-slate-700 hover:bg-slate-200">Discard</button>
                <button onClick={() => handleResumeSession(true)} className="flex-1 rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700">Resume</button>
              </div>
            </div>
          </div>
        )}
       </div>
     </div>
   );
 }
