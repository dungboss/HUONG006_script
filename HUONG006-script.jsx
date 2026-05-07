#target photoshop

'use strict';

app.preferences.rulerUnits = Units.PIXELS;
app.bringToFront();

var baseFolder = (new File($.fileName)).parent;
var outputFolder = new Folder(baseFolder.fsName + "/Result");

var exportOptions = new ExportOptionsSaveForWeb();
exportOptions.quality = 100;
exportOptions.PNG8 = false;
exportOptions.format = SaveDocumentType.PNG;

main();

function main() {
  if (!outputFolder.exists && !outputFolder.create()) {
    alert("Result folder cannot be created");
    return;
  }

  var selection = showSelectionDialog();
  if (!selection) {
    return;
  }

  var records = loadInputRecords(selection.inputFile);
  if (records.length === 0) {
    alert("Không tìm thấy dữ liệu hợp lệ trong file input.csv.");
    return;
  }

  sortRecordsByLength(records);

  var skippedCount = 0;
  for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
    var record = records[recordIndex];
    var template = getTemplateForName(record.sourceName, selection.rules);
    if (!template) {
      skippedCount++;
      continue;
    }
    processName(record.sourceName, record.outputName, record.content, template);
  }

  if (skippedCount > 0) {
    alert(skippedCount + " name(s) did not match any length rule.");
  }
}

function loadInputRecords(fileObj) {
  fileObj.encoding = "UTF-8";
  if (!fileObj.open("r")) {
    alert("Không thể mở file " + fileObj.name);
    return [];
  }
  var content = fileObj.read();
  fileObj.close();
  if (content.length > 0 && content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
  }
  var rows = parseCsvRows(content);
  var items = [];
  var headerSkipped = false;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (isRowEmpty(row)) {
      continue;
    }

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    var outputName = row.length > 0 ? trimString(row[0]) : "";

    var sourceName = "";
    if (row.length > 1) {
      sourceName = trimString(row[1]);
    }
    if (sourceName.length === 0) {
      continue;
    }

    var content = "";
    if (row.length > 2) {
      content = trimString(row[2]);
    }

    if (outputName.length === 0) {
      outputName = sourceName;
    }

    items.push({
      sourceName: sourceName,
      outputName: outputName,
      content: content
    });
  }

  return items;
}

function parseCsvRows(content) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  for (var i = 0; i < content.length; i++) {
    var ch = content.charAt(i);

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (ch === '\r' && i + 1 < content.length && content.charAt(i + 1) === '\n') {
        i++;
      }
      continue;
    }

    field += ch;
  }

  row.push(field);
  rows.push(row);
  return rows;
}

function isRowEmpty(row) {
  if (!row) {
    return true;
  }

  for (var i = 0; i < row.length; i++) {
    if (trimString(row[i]).length > 0) {
      return false;
    }
  }
  return true;
}

function sortRecordsByLength(records) {
  records.sort(function (a, b) {
    var aLength = getNameLength(a.sourceName);
    var bLength = getNameLength(b.sourceName);

    if (aLength < bLength) {
      return -1;
    }
    if (aLength > bLength) {
      return 1;
    }

    var aName = String(a.sourceName).toLowerCase();
    var bName = String(b.sourceName).toLowerCase();
    if (aName < bName) {
      return -1;
    }
    if (aName > bName) {
      return 1;
    }

    var aOutputName = String(a.outputName).toLowerCase();
    var bOutputName = String(b.outputName).toLowerCase();
    if (aOutputName < bOutputName) {
      return -1;
    }
    if (aOutputName > bOutputName) {
      return 1;
    }

    return 0;
  });
}

function showSelectionDialog() {
  var dialog = new Window("dialog", "Select input CSV and template folder");
  dialog.orientation = "column";
  dialog.alignChildren = "fill";
  dialog.spacing = 10;
  dialog.margins = 16;

  var message = dialog.add("statictext", undefined, "Choose the input CSV, the template folder, and any number of length rules.");
  message.maximumSize.width = 420;

  var inputRow = addPathPickerRow(dialog, "input.csv", "csv");
  var templateFolderRow = addPathPickerRow(dialog, "Template folder", "folder");

  var defaultInputFile = getDefaultInputFile();
  inputRow.value = defaultInputFile;
  inputRow.pathField.text = defaultInputFile.fsName;

  var defaultTemplateFolder = getDefaultTemplateFolder();
  templateFolderRow.value = defaultTemplateFolder;
  templateFolderRow.pathField.text = defaultTemplateFolder.fsName;

  var rulePanel = dialog.add("panel", undefined, "Length rules");
  rulePanel.orientation = "column";
  rulePanel.alignChildren = "fill";
  rulePanel.spacing = 8;
  rulePanel.margins = 10;

  var ruleNote = rulePanel.add("statictext", undefined, "Use Min/Max. Leave Max blank for open-ended.");
  ruleNote.maximumSize.width = 420;

  var ruleList = rulePanel.add("group");
  ruleList.orientation = "column";
  ruleList.alignChildren = "fill";
  ruleList.spacing = 6;

  var ruleRows = [];
  var currentTemplateFiles = [];
  if (defaultTemplateFolder.exists) {
    currentTemplateFiles = loadTemplateFiles(defaultTemplateFolder);
  }

  for (var defaultLength = 3; defaultLength <= 11; defaultLength++) {
    ruleRows.push(
      addRuleRow(
        ruleList,
        ruleRows,
        {
          min: defaultLength,
          max: defaultLength,
          templateName: "HUONG006_" + String(defaultLength)
        },
        currentTemplateFiles
      )
    );
  }

  var ruleButtonRow = rulePanel.add("group");
  ruleButtonRow.alignment = "right";
  var addRuleButton = ruleButtonRow.add("button", undefined, "Add rule");

  addRuleButton.onClick = function () {
    ruleRows.push(addRuleRow(ruleList, ruleRows, null, currentTemplateFiles));
    dialog.layout.layout(true);
  };

  templateFolderRow.browseButton.onClick = function () {
    var folder = Folder.selectDialog("Select the template folder");
    if (!folder) {
      return;
    }
    templateFolderRow.value = folder;
    templateFolderRow.pathField.text = folder.fsName;

    currentTemplateFiles = loadTemplateFiles(folder);
    if (currentTemplateFiles.length === 0) {
      alert("No PSD files were found in the selected folder.");
      templateFolderRow.value = null;
      templateFolderRow.pathField.text = "";
      populateRuleRowsTemplateFiles(ruleRows, currentTemplateFiles);
      dialog.layout.layout(true);
      return;
    }
    populateRuleRowsTemplateFiles(ruleRows, currentTemplateFiles);
    dialog.layout.layout(true);
  };

  var buttonGroup = dialog.add("group");
  buttonGroup.alignment = "right";
  var okButton = buttonGroup.add("button", undefined, "OK", { name: "ok" });
  var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

  okButton.onClick = function () {
    dialog.close(1);
  };
  cancelButton.onClick = function () {
    dialog.close(0);
  };

  if (dialog.show() != 1) {
    return null;
  }

  if (!inputRow.value || !templateFolderRow.value) {
    alert("Vui lòng chọn file input.csv và thư mục template.");
    return null;
  }

  if (!inputRow.value.exists) {
    alert("Không tìm thấy file input.csv.");
    return null;
  }

  if (!isCsvFile(inputRow.value)) {
    alert("File input phải là định dạng .csv.");
    return null;
  }

  if (!templateFolderRow.value.exists) {
    alert("Template folder is not found.");
    return null;
  }

  var rules = buildRulesFromRows(ruleRows);
  if (!rules) {
    return null;
  }

  return {
    inputFile: inputRow.value,
    rules: rules
  };
}

function getDefaultInputFile() {
  return new File(baseFolder.fsName + "/input.csv");
}

function getDefaultTemplateFolder() {
  var candidateFolders = [
    new Folder(baseFolder.fsName),
    new Folder(baseFolder.fsName + "/PTS")
  ];

  for (var i = 0; i < candidateFolders.length; i++) {
    if (!candidateFolders[i].exists) {
      continue;
    }
    if (loadTemplateFiles(candidateFolders[i]).length > 0) {
      return candidateFolders[i];
    }
  }

  for (var j = 0; j < candidateFolders.length; j++) {
    if (candidateFolders[j].exists) {
      return candidateFolders[j];
    }
  }

  return candidateFolders[0];
}

function addPathPickerRow(parent, label, kind) {
  var row = parent.add("group");
  row.orientation = "row";
  row.alignChildren = ["left", "center"];
  row.spacing = 10;

  row.add("statictext", undefined, label);

  var pathField = row.add("edittext", undefined, "");
  pathField.preferredSize.width = 300;
  pathField.enabled = false;

  var browseButton = row.add("button", undefined, "Browse...");
  row.pathField = pathField;
  row.browseButton = browseButton;
  row.value = null;

  browseButton.onClick = function () {
    if (kind === "folder") {
      var folder = Folder.selectDialog("Select " + label);
      if (!folder) {
        return;
      }
      row.value = folder;
      pathField.text = folder.fsName;
      return;
    }

    var file = File.openDialog("Select " + label);
    if (!file) {
      return;
    }
    if (kind === "csv" && !isCsvFile(file)) {
      row.value = null;
      pathField.text = "";
      alert("Vui lòng chọn file input có định dạng .csv.");
      return;
    }
    row.value = file;
    pathField.text = file.fsName;
  };

  return row;
}

function addRuleRow(parent, ruleRows, defaults, templateFiles) {
  var row = parent.add("group");
  row.orientation = "row";
  row.alignChildren = ["left", "center"];
  row.spacing = 10;
  row.defaultTemplateName = defaults && defaults.templateName ? defaults.templateName : null;

  row.add("statictext", undefined, "Min");

  row.minField = row.add("edittext", undefined, defaults && defaults.min !== null && typeof defaults.min !== "undefined" ? String(defaults.min) : "");
  row.minField.preferredSize.width = 36;

  row.add("statictext", undefined, "Max");

  row.maxField = row.add("edittext", undefined, defaults && defaults.max !== null && typeof defaults.max !== "undefined" ? String(defaults.max) : "");
  row.maxField.preferredSize.width = 36;

  row.templateDropdown = row.add("dropdownlist", undefined, []);
  row.templateDropdown.preferredSize.width = 300;

  row.removeButton = row.add("button", undefined, "Remove");
  row.templateFiles = [];

  populateRuleRowTemplates(row, templateFiles || []);

  row.removeButton.onClick = function () {
    if (ruleRows.length <= 1) {
      alert("Keep at least one length rule.");
      return;
    }

    var rowIndex = -1;
    for (var i = 0; i < ruleRows.length; i++) {
      if (ruleRows[i] === row) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return;
    }

    ruleRows.splice(rowIndex, 1);
    parent.remove(row);
    parent.layout.layout(true);
  };

  return row;
}

function populateRuleRowsTemplateFiles(ruleRows, templateFiles) {
  for (var i = 0; i < ruleRows.length; i++) {
    populateRuleRowTemplates(ruleRows[i], templateFiles);
  }
}

function populateRuleRowTemplates(row, templateFiles) {
  var previousTemplateName = getSelectedTemplateName(row);
  var dropdown = row.templateDropdown;

  while (dropdown.items.length > 0) {
    dropdown.remove(0);
  }

  row.templateFiles = templateFiles || [];

  if (!templateFiles || templateFiles.length === 0) {
    dropdown.add("item", "Select template folder first");
    dropdown.selection = 0;
    dropdown.enabled = false;
    return null;
  }

  dropdown.add("item", "Select template");
  for (var i = 0; i < templateFiles.length; i++) {
    dropdown.add("item", templateFiles[i].name);
  }
  dropdown.enabled = true;

  var selectedIndex = 0;
  if (previousTemplateName) {
    selectedIndex = findTemplateIndexByName(templateFiles, previousTemplateName) + 1;
    if (selectedIndex === 0 && row.defaultTemplateName) {
      selectedIndex = findTemplateIndexByName(templateFiles, row.defaultTemplateName) + 1;
    }
  } else if (row.defaultTemplateName) {
    selectedIndex = findTemplateIndexByName(templateFiles, row.defaultTemplateName) + 1;
  }

  dropdown.selection = selectedIndex;
}

function getSelectedTemplateName(row) {
  if (!row.templateDropdown.selection || row.templateDropdown.selection.index === 0) {
    return null;
  }
  return row.templateDropdown.selection.text;
}

function getSelectedTemplateFile(row) {
  if (!row.templateDropdown.selection || row.templateDropdown.selection.index === 0) {
    return null;
  }
  var index = row.templateDropdown.selection.index - 1;
  if (!row.templateFiles || index < 0 || index >= row.templateFiles.length) {
    return null;
  }
  return row.templateFiles[index];
}

function findTemplateIndexByName(templateFiles, templateName) {
  if (!templateFiles || !templateName) {
    return -1;
  }

  var normalizedTemplateName = normalizeTemplateName(templateName);
  for (var i = 0; i < templateFiles.length; i++) {
    if (normalizeTemplateName(templateFiles[i].name) === normalizedTemplateName) {
      return i;
    }
  }
  return -1;
}

function normalizeTemplateName(name) {
  name = trimString(String(name)).toLowerCase();
  var dotIndex = name.lastIndexOf(".");
  if (dotIndex > 0) {
    return name.substring(0, dotIndex);
  }
  return name;
}

function buildRulesFromRows(ruleRows) {
  var rules = [];
  for (var i = 0; i < ruleRows.length; i++) {
    var row = ruleRows[i];
    var minValue = parseLengthValue(row.minField.text, false);
    var maxValue = parseLengthValue(row.maxField.text, true);
    var templateFile = getSelectedTemplateFile(row);

    if (isNaN(minValue)) {
      alert("Invalid Min value in rule " + (i + 1) + ".");
      return null;
    }

    if (maxValue !== null && isNaN(maxValue)) {
      alert("Invalid Max value in rule " + (i + 1) + ". Leave it blank for open-ended.");
      return null;
    }

    if (maxValue !== null && maxValue < minValue) {
      alert("Max must be greater than or equal to Min in rule " + (i + 1) + ".");
      return null;
    }

    if (!templateFile) {
      alert("Please choose a template in rule " + (i + 1) + ".");
      return null;
    }

    if (!isPsdFile(templateFile)) {
      alert("Template in rule " + (i + 1) + " must be a .psd file.");
      return null;
    }

    rules.push({
      min: minValue,
      max: maxValue,
      template: templateFile
    });
  }

  sortRulesByRange(rules);
  if (!validateRules(rules)) {
    return null;
  }
  return rules;
}

function parseLengthValue(text, allowBlank) {
  text = trimString(text);
  if (text.length === 0) {
    return allowBlank ? null : NaN;
  }
  var normalized = text.replace(/\s+/g, "");

  if (allowBlank) {
    if (/^\+$/.test(normalized) || /^\d+\+$/.test(normalized)) {
      return null;
    }
    if (/^\d+$/.test(normalized)) {
      return parseInt(normalized, 10);
    }
    return NaN;
  }

  if (/^\d+$/.test(normalized)) {
    return parseInt(normalized, 10);
  }
  return NaN;
}

function trimString(value) {
  return String(value).replace(/^\s+|\s+$/g, "");
}

function isCsvFile(fileObj) {
  return !!fileObj && /\.csv$/i.test(fileObj.name);
}

function isPsdFile(fileObj) {
  return !!fileObj && /\.psd$/i.test(fileObj.name);
}

function sortRulesByRange(rules) {
  rules.sort(function (a, b) {
    if (a.min < b.min) {
      return -1;
    }
    if (a.min > b.min) {
      return 1;
    }

    var aMax = a.max === null ? 999999999 : a.max;
    var bMax = b.max === null ? 999999999 : b.max;
    if (aMax < bMax) {
      return -1;
    }
    if (aMax > bMax) {
      return 1;
    }
    return 0;
  });
}

function validateRules(rules) {
  for (var i = 0; i < rules.length - 1; i++) {
    var currentRule = rules[i];
    var nextRule = rules[i + 1];

    if (currentRule.max === null) {
      alert("Open-ended rules must be the last rule.");
      return false;
    }

    if (nextRule.min <= currentRule.max) {
      alert("Length rules overlap between rule " + (i + 1) + " and rule " + (i + 2) + ".");
      return false;
    }
  }
  return true;
}

function loadTemplateFiles(folderObj) {
  var files = folderObj.getFiles(/\.(psd)$/i);
  sortFilesByName(files);
  return files;
}

function sortFilesByName(files) {
  files.sort(function (a, b) {
    var an = a.name.toLowerCase();
    var bn = b.name.toLowerCase();
    if (an < bn) {
      return -1;
    }
    if (an > bn) {
      return 1;
    }
    return 0;
  });
}

function getTemplateForName(name, rules) {
  var length = getNameLength(name);
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (length < rule.min) {
      continue;
    }
    if (rule.max !== null && length > rule.max) {
      continue;
    }
    return rule.template;
  }
  return null;
}

function getNameLength(name) {
  name = String(name);
  name = name.replace(/^\s+|\s+$/g, "");
  return name.length;
}

function processName(sourceName, outputName, content, template) {
  open(template);
  var doc = app.activeDocument;

  var nameLayers = findLayers(doc, true, {
    typename: "ArtLayer",
    kind: LayerKind.TEXT,
    name: "name"
  });
  var smallNameLayers = findLayers(doc, true, {
    typename: "ArtLayer",
    kind: LayerKind.TEXT,
    name: "name_small"
  });
  var contentItems = parseContentItems(content);
  var contentLayerMap = getContentLayerMap(doc);

  var missingLayers = [];
  if (nameLayers.length === 0) {
    missingLayers.push("name");
  }
  if (smallNameLayers.length === 0) {
    missingLayers.push("name_small");
  }

  for (var i = 0; i < contentItems.length; i++) {
    var index = i + 1;
    var layerPair = contentLayerMap.pairs[index];
    if (!layerPair) {
      missingLayers.push(String(index));
      missingLayers.push(String(index) + "_detail");
      continue;
    }
    if (!layerPair.base) {
      missingLayers.push(String(index));
    }
    if (!layerPair.detail) {
      missingLayers.push(String(index) + "_detail");
    }
  }

  if (contentItems.length === 0) {
    doc.close(SaveOptions.DONOTSAVECHANGES);
    alert("Cột content bị thiếu hoặc không hợp lệ.");
    return;
  }

  if (missingLayers.length > 0) {
    doc.close(SaveOptions.DONOTSAVECHANGES);
    alert("Thiếu text layer: " + missingLayers.join(", "));
    return;
  }

  changeTextLayerContent(nameLayers[0], String(sourceName), "center", false, true, true);
  changeTextLayerContent(smallNameLayers[0], String(sourceName), "preserve", false, true, true);

  for (var j = 0; j < contentItems.length; j++) {
    var pairIndex = j + 1;
    var pair = contentLayerMap.pairs[pairIndex];
    changeTextLayerContent(pair.base, contentItems[j].letter, "preserve", true);
    changeTextLayerContent(pair.detail, contentItems[j].detail, "preserve", true, true, true);
  }

  for (var k = contentItems.length + 1; k <= contentLayerMap.maxIndex; k++) {
    var extraPair = contentLayerMap.pairs[k];
    if (extraPair) {
      if (extraPair.base) {
        changeTextLayerContent(extraPair.base, "", "preserve", true);
      }
      if (extraPair.detail) {
        changeTextLayerContent(extraPair.detail, "", "preserve", true, true, true);
      }
    }
  }

  var outputFileName = buildOutputFileName(outputName);
  app.activeDocument.exportDocument(
    new File(outputFolder.fsName + "/" + outputFileName),
    ExportType.SAVEFORWEB,
    exportOptions
  );

  doc.close(SaveOptions.DONOTSAVECHANGES);
}

function changeTextLayerContent(textLayer, textContent, justificationMode, preserveX, preserveFont, preserveSize) {
  if (!textLayer) {
    return;
  }

  app.activeDocument.activeLayer = textLayer;
  var originalBounds = null;
  var originalSizePt = getTextSizeInPoints(textLayer);
  var originalFont = null;
  if (preserveFont === true) {
    originalFont = getTextLayerFont(textLayer);
  }
  if (preserveX === true) {
    originalBounds = getLayerBoundsPx(textLayer);
  }
  textContent = textContent.replace(/\n/g, " ");
  textLayer.textItem.contents = textContent;
  if (preserveFont === true && originalFont) {
    try {
      textLayer.textItem.font = originalFont;
    } catch (e) {
      // Ignore font restore failures and keep Photoshop's current font.
    }
  }
  if (preserveSize !== false && !isNaN(originalSizePt)) {
    setTextLayerSizePt(textLayer, originalSizePt);
  }
  if (justificationMode === "center") {
    textLayer.textItem.justification = Justification.CENTER;
  }

  if (preserveX === true) {
    var currentBounds = getLayerBoundsPx(textLayer);
    var deltaX = originalBounds.left - currentBounds.left;
    if (deltaX !== 0) {
      textLayer.translate(deltaX, 0);
    }
  }
}

function getTextLayerFont(textLayer) {
  try {
    return String(textLayer.textItem.font);
  } catch (e) {
    return null;
  }
}

function parseContentItems(content) {
  var items = [];
  content = trimString(content);
  if (content.length === 0) {
    return items;
  }

  var parts = content.split(",");
  for (var i = 0; i < parts.length; i++) {
    var part = trimString(parts[i]);
    if (part.length === 0) {
      continue;
    }

    var dashIndex = part.indexOf("-");
    var letter = "";
    var detail = "";
    if (dashIndex >= 0) {
      letter = trimString(part.substring(0, dashIndex));
      detail = trimString(part.substring(dashIndex + 1));
    } else {
      letter = part;
    }

    items.push({
      letter: letter,
      detail: detail.length > 0 ? "= " + detail : ""
    });
  }

  return items;
}

function getContentLayerMap(doc) {
  var textLayers = findLayers(doc, true, {
    typename: "ArtLayer",
    kind: LayerKind.TEXT
  });
  var pairs = [];
  var maxIndex = 0;

  for (var i = 0; i < textLayers.length; i++) {
    var layer = textLayers[i];
    var layerName = String(layer.name);
    var match = layerName.match(/^(\d+)(?:_detail)?$/);
    if (!match) {
      continue;
    }

    var index = parseInt(match[1], 10);
    if (!pairs[index]) {
      pairs[index] = {
        base: null,
        detail: null
      };
    }

    if (/_detail$/.test(layerName)) {
      pairs[index].detail = layer;
    } else {
      pairs[index].base = layer;
    }

    if (index > maxIndex) {
      maxIndex = index;
    }
  }

  return {
    pairs: pairs,
    maxIndex: maxIndex
  };
}

function fitTextLayerToBox(textLayer, targetWidth, targetHeight, originalSizePt) {
  var maxSizePt = Math.max(originalSizePt * 20, originalSizePt + 1);
  var low;
  var high;
  var best;

  setTextLayerSizePt(textLayer, originalSizePt);

  if (textLayerFitsBox(textLayer, targetWidth, targetHeight)) {
    low = originalSizePt;
    high = originalSizePt * 2;

    if (high <= low) {
      high = low + 1;
    }

    while (high <= maxSizePt) {
      setTextLayerSizePt(textLayer, high);
      if (!textLayerFitsBox(textLayer, targetWidth, targetHeight)) {
        break;
      }

      low = high;
      high = high * 2;
    }

    if (high > maxSizePt) {
      setTextLayerSizePt(textLayer, maxSizePt);
      return;
    }
  } else {
    low = 1;
    high = originalSizePt;
  }

  best = low;
  for (var i = 0; i < 12; i++) {
    var mid = (low + high) / 2;
    setTextLayerSizePt(textLayer, mid);
    if (textLayerFitsBox(textLayer, targetWidth, targetHeight)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  setTextLayerSizePt(textLayer, best);
}

function textLayerFitsBox(textLayer, targetWidth, targetHeight) {
  var bounds = getLayerBoundsPx(textLayer);
  var tolerance = 1;
  return bounds.width <= targetWidth + tolerance && bounds.height <= targetHeight + tolerance;
}

function setTextLayerSizePt(textLayer, sizePt) {
  textLayer.textItem.size = new UnitValue(sizePt, "pt");
}

function getTextSizeInPoints(textLayer) {
  var size = textLayer.textItem.size;
  if (size && typeof size.as === "function") {
    return size.as("pt");
  }
  if (size && typeof size.value !== "undefined") {
    return size.value;
  }
  return Number(size);
}

function getTextBoxSizePx(textLayer, fallbackBounds) {
  var item = textLayer.textItem;
  var width = 0;
  var height = 0;

  try {
    if (item.width && item.height) {
      width = unitValueToPx(item.width);
      height = unitValueToPx(item.height);
    }
  } catch (e) {
    width = 0;
    height = 0;
  }

  if (width > 0 && height > 0) {
    return {
      width: width,
      height: height
    };
  }

  return {
    width: fallbackBounds.width,
    height: fallbackBounds.height
  };
}

function getLayerBoundsPx(layer) {
  var bounds = layer.bounds;
  var left = unitValueToPx(bounds[0]);
  var top = unitValueToPx(bounds[1]);
  var right = unitValueToPx(bounds[2]);
  var bottom = unitValueToPx(bounds[3]);

  return {
    left: left,
    top: top,
    right: right,
    bottom: bottom,
    width: right - left,
    height: bottom - top
  };
}

function unitValueToPx(value) {
  if (value && typeof value.as === "function") {
    return value.as("px");
  }
  if (value && typeof value.value !== "undefined") {
    return value.value;
  }
  return Number(value);
}

function sanitizeFileName(name) {
  return name.replace(/[\\\/:\*\?"<>\|]/g, "_");
}

function buildOutputFileName(outputName) {
  var fileName = sanitizeFileName(trimString(outputName)).replace(/[\. ]+$/g, "");
  if (fileName.length === 0) {
    fileName = "output";
  }
  if (!/\.png$/i.test(fileName)) {
    fileName += ".png";
  }
  return fileName;
}

function findLayers(searchFolder, recursion, userData, items) {
  items = items || [];
  var folderItem;
  for (var i = 0; i < searchFolder.layers.length; i++) {
    folderItem = searchFolder.layers[i];
    if (propertiesMatch(folderItem, userData)) {
      items.push(folderItem);
    }
    if (recursion === true && folderItem.typename === "LayerSet") {
      findLayers(folderItem, recursion, userData, items);
    }
  }
  return items;
}

function propertiesMatch(projectItem, userData) {
  if (typeof userData === "undefined") return true;
  for (var propertyName in userData) {
    if (!userData.hasOwnProperty(propertyName)) continue;
    if (!projectItem.hasOwnProperty(propertyName)) return false;
    if (projectItem[propertyName].toString() !== userData[propertyName].toString()) {
      return false;
    }
  }
  return true;
}
