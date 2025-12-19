"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import readXlsxFile from "read-excel-file";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
}

interface TargetField {
  name: string;
  label: string;
  required: boolean;
  type: "text" | "email" | "phone" | "select" | "boolean";
  options?: string[];
}

interface BulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  targetFields: TargetField[];
  onUpload: (data: Record<string, any>[]) => Promise<{ success: number; errors: string[] }>;
}

type Step = "upload" | "mapping" | "preview" | "importing";

export function BulkUploadDialog({
  open,
  onClose,
  title,
  targetFields,
  onUpload,
}: BulkUploadDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);

  const PREVIEW_PAGE_SIZE = 10;

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setRawData([]);
    setSourceColumns([]);
    setMappings([]);
    setImporting(false);
    setPreviewPage(0);
    setImportResults(null);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    try {
      const data = await parseFile(selectedFile);
      if (data.length === 0) {
        toast.error("No data found in file");
        return;
      }

      setRawData(data);
      const columns = Object.keys(data[0]);
      setSourceColumns(columns);

      // Auto-map columns based on name similarity
      const autoMappings: FieldMapping[] = [];
      for (const field of targetFields) {
        const matchingColumn = columns.find(
          (col) =>
            col.toLowerCase().replace(/[_\s-]/g, "") ===
            field.name.toLowerCase().replace(/[_\s-]/g, "") ||
            col.toLowerCase().includes(field.name.toLowerCase()) ||
            field.name.toLowerCase().includes(col.toLowerCase())
        );
        if (matchingColumn) {
          autoMappings.push({ sourceColumn: matchingColumn, targetField: field.name });
        }
      }
      setMappings(autoMappings);
      setStep("mapping");
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Failed to parse file. Please check the format.");
    }
  };

  const parseFile = async (file: File): Promise<Record<string, any>[]> => {
    if (file.name.endsWith(".csv")) {
      // Parse CSV
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        return [];
      }

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map((line) => {
        const values = parseCSVLine(line);
        const obj: Record<string, any> = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim() || "";
        });
        return obj;
      });
      return rows;
    } else {
      // Parse Excel with read-excel-file
      const rows = await readXlsxFile(file);

      if (rows.length < 2) {
        return [];
      }

      // First row is headers
      const headers = rows[0].map((cell, i) =>
        cell !== null && cell !== undefined ? String(cell) : `Column${i + 1}`
      );

      // Convert remaining rows to objects
      const jsonData: Record<string, any>[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj: Record<string, any> = {};
        let hasData = false;

        headers.forEach((header, colIndex) => {
          const value = row[colIndex];
          if (value === null || value === undefined) {
            obj[header] = "";
          } else {
            obj[header] = String(value);
            hasData = true;
          }
        });

        if (hasData) {
          jsonData.push(obj);
        }
      }

      return jsonData;
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const updateMapping = (targetField: string, sourceColumn: string) => {
    setMappings((prev) => {
      const existing = prev.findIndex((m) => m.targetField === targetField);
      if (sourceColumn === "__skip__") {
        // Remove mapping
        return prev.filter((m) => m.targetField !== targetField);
      }
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { sourceColumn, targetField };
        return updated;
      }
      return [...prev, { sourceColumn, targetField }];
    });
  };

  const getMappedValue = (targetField: string) => {
    return mappings.find((m) => m.targetField === targetField)?.sourceColumn || "__skip__";
  };

  const transformedData = useMemo(() => {
    return rawData.map((row) => {
      const transformed: Record<string, any> = {};
      for (const mapping of mappings) {
        transformed[mapping.targetField] = row[mapping.sourceColumn] || "";
      }
      return transformed;
    });
  }, [rawData, mappings]);

  const validationErrors = useMemo(() => {
    const errors: { row: number; field: string; message: string }[] = [];
    const requiredFields = targetFields.filter((f) => f.required);

    transformedData.forEach((row, idx) => {
      for (const field of requiredFields) {
        const value = row[field.name];
        if (!value || (typeof value === "string" && !value.trim())) {
          errors.push({
            row: idx + 1,
            field: field.label,
            message: `${field.label} is required`,
          });
        }
      }

      // Email validation
      const emailFields = targetFields.filter((f) => f.type === "email");
      for (const field of emailFields) {
        const value = row[field.name];
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({
            row: idx + 1,
            field: field.label,
            message: `Invalid email format`,
          });
        }
      }
    });

    return errors;
  }, [transformedData, targetFields]);

  const canProceedToPreview = useMemo(() => {
    const requiredFields = targetFields.filter((f) => f.required);
    return requiredFields.every((f) =>
      mappings.some((m) => m.targetField === f.name)
    );
  }, [targetFields, mappings]);

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error(`${validationErrors.length} validation errors found. Please fix them first.`);
      return;
    }

    setImporting(true);
    setStep("importing");

    try {
      const results = await onUpload(transformedData);
      setImportResults(results);

      if (results.success > 0) {
        toast.success(`Successfully imported ${results.success} records`);
      }
      if (results.errors.length > 0) {
        toast.error(`${results.errors.length} records failed to import`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import data");
      setImportResults({ success: 0, errors: ["Unexpected error occurred"] });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 border-b">
          {[
            { key: "upload" as Step, label: "Upload File", stepIndex: 0 },
            { key: "mapping" as Step, label: "Map Fields", stepIndex: 1 },
            { key: "preview" as Step, label: "Preview & Import", stepIndex: 2 },
          ].map((s, i) => {
            const stepOrder: Step[] = ["upload", "mapping", "preview", "importing"];
            const currentIndex = stepOrder.indexOf(step);
            const thisIndex = s.stepIndex;
            const isCompleted = currentIndex > thisIndex;
            const isCurrent = step === s.key || (step === "importing" && s.key === "preview");

            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                  {s.label}
                </div>
                {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-4 bg-muted rounded-full">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Upload your file</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports CSV, XLS, and XLSX files. No template required - we'll help you map the columns.
                </p>
              </div>
              <Label
                htmlFor="file-upload"
                className="cursor-pointer px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Choose File
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-muted-foreground">
                  Found <strong>{rawData.length}</strong> rows and <strong>{sourceColumns.length}</strong> columns in your file.
                  Map your columns to the appropriate fields below.
                </p>
              </div>

              <div className="space-y-3">
                {targetFields.map((field) => (
                  <div
                    key={field.name}
                    className="flex items-center gap-4 p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        {field.required && (
                          <Badge variant="destructive" className="text-[10px]">
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Type: {field.type}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={getMappedValue(field.name)}
                      onValueChange={(value) => updateMapping(field.name, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">
                          <span className="text-muted-foreground">-- Skip this field --</span>
                        </SelectItem>
                        {sourceColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getMappedValue(field.name) !== "__skip__" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {validationErrors.length} validation error(s) found
                  </div>
                  <div className="text-sm text-red-600 space-y-1 max-h-24 overflow-y-auto">
                    {validationErrors.slice(0, 5).map((err, i) => (
                      <p key={i}>
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                    {validationErrors.length > 5 && (
                      <p>...and {validationErrors.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">#</th>
                        {targetFields.map((field) => (
                          <th key={field.name} className="px-3 py-2 text-left font-medium">
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transformedData
                        .slice(
                          previewPage * PREVIEW_PAGE_SIZE,
                          (previewPage + 1) * PREVIEW_PAGE_SIZE
                        )
                        .map((row, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 text-muted-foreground">
                              {previewPage * PREVIEW_PAGE_SIZE + idx + 1}
                            </td>
                            {targetFields.map((field) => (
                              <td key={field.name} className="px-3 py-2">
                                {row[field.name] || (
                                  <span className="text-muted-foreground/50">-</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {transformedData.length > PREVIEW_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {previewPage * PREVIEW_PAGE_SIZE + 1} -{" "}
                    {Math.min((previewPage + 1) * PREVIEW_PAGE_SIZE, transformedData.length)} of{" "}
                    {transformedData.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                      disabled={previewPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPreviewPage((p) =>
                          Math.min(Math.ceil(transformedData.length / PREVIEW_PAGE_SIZE) - 1, p + 1)
                        )
                      }
                      disabled={(previewPage + 1) * PREVIEW_PAGE_SIZE >= transformedData.length}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              {importing ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <p className="text-lg font-medium">Importing...</p>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we import your data.
                  </p>
                </>
              ) : importResults ? (
                <>
                  {importResults.success > 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-6 w-6" />
                      <span className="text-lg font-medium">
                        {importResults.success} records imported successfully
                      </span>
                    </div>
                  )}
                  {importResults.errors.length > 0 && (
                    <div className="w-full max-w-md">
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <X className="h-5 w-5" />
                        <span className="font-medium">
                          {importResults.errors.length} errors occurred
                        </span>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto text-sm text-red-600">
                        {importResults.errors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!canProceedToPreview}
              >
                Preview Data
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validationErrors.length > 0}
              >
                Import {transformedData.length} Records
              </Button>
            </>
          )}

          {step === "importing" && !importing && (
            <Button onClick={handleClose}>
              {importResults?.success ? "Done" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
