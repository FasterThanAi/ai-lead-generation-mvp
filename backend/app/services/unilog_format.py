import csv
import io
import json
import os
import re
from typing import Any

# Path to standard headers JSON
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
HEADERS_FILE = os.path.join(SERVICES_DIR, "unilog_headers.json")

_CACHED_HEADERS: list[str] | None = None


def load_unilog_headers() -> list[str]:
    global _CACHED_HEADERS
    if _CACHED_HEADERS is None:
        with open(HEADERS_FILE, "r", encoding="utf-8") as f:
            _CACHED_HEADERS = json.load(f)
    return list(_CACHED_HEADERS)


def strip_vendor_code(raw_manuf: str | None) -> str:
    """
    Derives canonical manufacturer name by stripping trailing vendor codes.
    Example: 'Freud Inc (2435)' -> 'Freud Inc'
             'Jam Industrial Supply LLC (JAMIN)' -> 'Jam Industrial Supply LLC'
             'Swagelok' -> 'Swagelok'
    """
    if not raw_manuf:
        return ""
    val = str(raw_manuf).strip()
    # Strip trailing parenthetical vendor code e.g. (2435) or (JAMIN)
    cleaned = re.sub(r"\s*\([^\)]*\)\s*$", "", val).strip()
    return cleaned or val


def build_row(
    source_row: dict[str, Any] | None = None,
    taxonomy: dict[str, Any] | None = None,
    descriptions: dict[str, Any] | None = None,
    attributes: list[dict[str, Any]] | None = None,
    features: list[str] | None = None,
    approvals: list[str] | None = None,
    documents: list[dict[str, Any]] | None = None,
    urls: dict[str, Any] | None = None,
    identifiers: dict[str, Any] | None = None,
    quality: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Constructs a complete 252-column dictionary adhering strictly to unilog_headers.json.
    """
    headers = load_unilog_headers()
    row: dict[str, Any] = {h: "" for h in headers}

    source_row = source_row or {}
    taxonomy = taxonomy or {}
    descriptions = descriptions or {}
    attributes = attributes or []
    features = features or []
    approvals = approvals or []
    documents = documents or []
    urls = urls or {}
    identifiers = identifiers or {}
    quality = quality or {}

    # 1. Six Evaluation Input Passthrough (Stored verbatim)
    row["Mfg_Part_Num"] = source_row.get("part_number") or source_row.get("Mfg_Part_Num") or ""
    row["Part_Desc"] = source_row.get("short_description") or source_row.get("Part_Desc") or ""
    row["E1_Brand"] = source_row.get("e1_brand") or source_row.get("E1_Brand") or "-- Unbranded --"
    row["Unilog_Brand"] = source_row.get("unilog_brand") or source_row.get("Unilog_Brand") or "-- No Unilog Brand --"
    row["DIB_Brand"] = source_row.get("dib_brand") or source_row.get("DIB_Brand") or "-- No DIB Brand --"
    row["Part_Manuf"] = source_row.get("part_manuf") or source_row.get("Part_Manuf") or ""

    # 2. Product Identifiers
    row["Manufacturer_Part_Number"] = identifiers.get("part_number") or row["Mfg_Part_Num"]
    raw_manuf = row["Part_Manuf"]
    derived_manuf = strip_vendor_code(raw_manuf) if raw_manuf else identifiers.get("manufacturer", "")
    row["Manufacturer_Name"] = identifiers.get("manufacturer") or derived_manuf
    row["Brand_Name"] = identifiers.get("brand") or derived_manuf
    row["Product_Name"] = descriptions.get("product_name") or identifiers.get("canonical_name") or row["Part_Desc"]

    # 3. Taxonomy
    row["Dept"] = taxonomy.get("dept") or ""
    row["Class"] = taxonomy.get("class_name") or taxonomy.get("class") or ""
    row["Fine"] = taxonomy.get("fine") or ""
    row["Classpath"] = taxonomy.get("classpath") or (f"{row['Dept']}>{row['Class']}>{row['Fine']}" if row["Dept"] else "")
    row["UNSPSC"] = identifiers.get("unspsc") or ""

    # 4. Description Family
    row["Short_Desc"] = descriptions.get("short_desc") or row["Part_Desc"]
    row["Mobile_Desc"] = descriptions.get("mobile_desc") or ""
    row["Invoice_Desc"] = descriptions.get("invoice_desc") or ""
    row["Long_Desc"] = descriptions.get("long_desc") or descriptions.get("long_description") or ""
    row["Retail_Desc"] = descriptions.get("retail_desc") or ""
    row["Marketing_Desc"] = descriptions.get("marketing_desc") or ""

    # 5. Features (1..20)
    for i in range(1, 21):
        idx = i - 1
        row[f"Feature_{i}"] = features[idx] if idx < len(features) else ""

    # 6. Approvals (1..10)
    for i in range(1, 11):
        idx = i - 1
        row[f"Approval_{i}"] = approvals[idx] if idx < len(approvals) else ""

    # 7. Attributes (1..50 Triplets: Label, Value, UOM)
    for i in range(1, 51):
        idx = i - 1
        if idx < len(attributes):
            attr = attributes[idx]
            label = attr.get("label") or attr.get("key") or ""
            val = attr.get("value") or attr.get("value_norm") or attr.get("value_raw") or ""
            uom = attr.get("uom") or attr.get("unit") or ""
            row[f"Attribute_Label_{i}"] = label
            row[f"Attribute_Value_{i}"] = str(val) if val is not None else ""
            row[f"Attribute_UOM_{i}"] = str(uom) if uom is not None else ""
        else:
            row[f"Attribute_Label_{i}"] = ""
            row[f"Attribute_Value_{i}"] = ""
            row[f"Attribute_UOM_{i}"] = ""

    # 8. Documents (1..5 Triplets: Name, Type, URL)
    for i in range(1, 6):
        idx = i - 1
        if idx < len(documents):
            doc = documents[idx]
            row[f"Document_Name_{i}"] = doc.get("filename") or doc.get("name") or f"Doc #{i}"
            row[f"Document_Type_{i}"] = doc.get("doc_type") or doc.get("type") or "pdf"
            row[f"Document_URL_{i}"] = doc.get("url") or ""
        else:
            row[f"Document_Name_{i}"] = ""
            row[f"Document_Type_{i}"] = ""
            row[f"Document_URL_{i}"] = ""

    # 9. Media & URLs
    images = identifiers.get("images", [])
    for i in range(1, 6):
        idx = i - 1
        row[f"Image_URL_{i}"] = images[idx] if idx < len(images) else ""

    row["Manufacturer_URL"] = urls.get("manufacturer_url") or urls.get("manufacturer") or ""
    row["Product_URL"] = urls.get("product_url") or urls.get("product") or ""
    row["Reference_URL_1"] = urls.get("reference_url_1") or urls.get("ref1") or ""
    row["Reference_URL_2"] = urls.get("reference_url_2") or urls.get("ref2") or ""

    # 10. Trade & Quality Identifiers
    row["UPC"] = identifiers.get("upc") or ""
    row["GTIN"] = identifiers.get("gtin") or ""
    row["Country_Of_Origin"] = identifiers.get("country_of_origin") or ""
    row["Warranty"] = identifiers.get("warranty") or ""
    row["Hazardous_Material"] = identifiers.get("hazardous_material") or "No"
    row["Weight"] = identifiers.get("weight") or ""
    row["Weight_UOM"] = identifiers.get("weight_uom") or ("lbs" if row["Weight"] else "")
    row["Length"] = identifiers.get("length") or ""
    row["Width"] = identifiers.get("width") or ""
    row["Height"] = identifiers.get("height") or ""
    row["Dimension_UOM"] = identifiers.get("dimension_uom") or ("in" if row["Length"] else "")
    row["Minimum_Order_Quantity"] = identifiers.get("moq") or "1"
    row["Package_Quantity"] = identifiers.get("pkg_qty") or "1"
    row["List_Price"] = identifiers.get("list_price") or ""
    row["Currency"] = identifiers.get("currency") or ("USD" if row["List_Price"] else "")
    row["Primary_Image_URL"] = row["Image_URL_1"]
    row["Thumbnail_URL"] = row["Image_URL_1"]
    row["PDF_Spec_Sheet_URL"] = row["Document_URL_1"]
    row["Catalog_Page_URL"] = row["Document_URL_2"]
    row["Safety_Data_Sheet_URL"] = ""
    row["Installation_Manual_URL"] = ""
    row["Completeness_Score"] = quality.get("completeness_score", "")
    row["Confidence_Score"] = quality.get("confidence_score", "")
    row["Quality_Grade"] = quality.get("quality_grade", "")
    row["Status"] = quality.get("status", "approved")
    row["Extraction_Model"] = quality.get("model_used", "gemini-flash-latest")
    row["Enriched_Date"] = quality.get("enriched_at", "")

    return row


def write_csv(rows: list[dict[str, Any]]) -> bytes:
    """
    Serializes rows to UTF-8 CSV bytes with UTF-8 BOM for flawless Excel compatibility.
    """
    headers = load_unilog_headers()
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()

    for r in rows:
        writer.writerow(r)

    return output.getvalue().encode("utf-8")


def write_xlsx(rows: list[dict[str, Any]]) -> bytes:
    """
    Serializes rows to openpyxl XLSX spreadsheet bytes.
    """
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill

    headers = load_unilog_headers()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Unilog Catalog Delivery"

    # Header styling
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    ws.append(headers)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # Append rows
    for r in rows:
        ws.append([r.get(h, "") for h in headers])

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def validate(content: bytes | str) -> dict[str, Any]:
    """
    Validates that a CSV/XLSX delivery output adheres 100% to unilog_headers.json:
    - Checks exact 252 column count
    - Checks exact column order and name match
    """
    expected_headers = load_unilog_headers()

    if isinstance(content, bytes):
        try:
            text_data = content.decode("utf-8-sig")
        except Exception:
            text_data = content.decode("utf-8", errors="ignore")
    else:
        text_data = content

    reader = csv.reader(io.StringIO(text_data))
    header_row = next(reader, None)

    if not header_row:
        return {
            "valid": False,
            "headers_exact_match": False,
            "error": "Empty file or no header row found",
            "total_columns": 0,
            "expected_columns": len(expected_headers),
        }

    headers_exact_match = (header_row == expected_headers)
    column_count = len(header_row)

    mismatches = []
    if not headers_exact_match:
        for idx, (act, exp) in enumerate(zip(header_row, expected_headers)):
            if act != exp:
                mismatches.append(f"Col {idx+1}: expected '{exp}', got '{act}'")
        if len(header_row) != len(expected_headers):
            mismatches.append(f"Total count mismatch: expected {len(expected_headers)}, got {len(header_row)}")

    return {
        "valid": headers_exact_match,
        "headers_exact_match": headers_exact_match,
        "total_columns": column_count,
        "expected_columns": len(expected_headers),
        "mismatches": mismatches[:10],
    }
