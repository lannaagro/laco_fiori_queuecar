sap.ui.loader.config({
    shim: {
        "com/lannaagro/zdev/odatav2/zfarmerv2/thirdparty/xlsx.full.min": {
            amd: true,
            exports: "XLSX"
        }
    }
});

sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (MessageBox, MessageToast, JSONModel) {
    "use strict";

    const ACTION = "com.sap.gateway.srvd_a2x.zui_tmm_we_farmer_dev.v0001.uploadFarmer";
    const FRAGMENT = "com.lannaagro.zdev.odatav2.zfarmerv2.ext.fragment.UploadFarmerDialog";
    const XLSX_MODULE = "com/lannaagro/zdev/odatav2/zfarmerv2/thirdparty/xlsx.full.min";

    // Payload property -> accepted Excel column headers (compared case-insensitive, spaces/underscores ignored)
    const COLUMN_MAP = {
        FarmerNo: ["FarmerNo", "Farmer Number", "Farmer"],
        IdCard: ["IdCard", "ID Card", "IdCardNo"],
        Name: ["Name"],
        Address1: ["Address1"],
        Address2: ["Address2"],
        Address3: ["Address3"],
        Address4: ["Address4"],
        City: ["City"],
        Street: ["Street"],
        PostCode: ["PostCode", "Postal Code", "Zip"],
        Email: ["Email", "E-Mail"],
        Tel: ["Tel", "Telephone", "Phone"]
    };

    function normalize(sHeader) {
        return String(sHeader).replace(/[\s_-]/g, "").toLowerCase();
    }

    function loadXlsx() {
        return new Promise(function (resolve, reject) {
            sap.ui.require([XLSX_MODULE], resolve, reject);
        });
    }

    function readFileAsArrayBuffer(oFile) {
        return new Promise(function (resolve, reject) {
            const oReader = new FileReader();
            oReader.onload = function (oEvent) {
                resolve(oEvent.target.result);
            };
            oReader.onerror = function () {
                reject(oReader.error);
            };
            oReader.readAsArrayBuffer(oFile);
        });
    }

    /**
     * Reads the first sheet of the file and maps its columns to Farmer properties.
     */
    async function parseFarmerFile(oFile) {
        const XLSX = await loadXlsx();
        const oWorkbook = XLSX.read(await readFileAsArrayBuffer(oFile), { type: "array" });
        const oSheet = oWorkbook.Sheets[oWorkbook.SheetNames[0]];
        // raw: false keeps cell text as displayed (e.g. leading zeros in FarmerNo / PostCode)
        const aSheetRows = XLSX.utils.sheet_to_json(oSheet, { raw: false, defval: "" });

        const mHeaderToProperty = {};
        Object.keys(COLUMN_MAP).forEach(function (sProperty) {
            COLUMN_MAP[sProperty].forEach(function (sHeader) {
                mHeaderToProperty[normalize(sHeader)] = sProperty;
            });
        });

        return aSheetRows.map(function (oSheetRow) {
            const oFarmer = {};
            Object.keys(oSheetRow).forEach(function (sHeader) {
                const sProperty = mHeaderToProperty[normalize(sHeader)];
                if (sProperty) {
                    oFarmer[sProperty] = String(oSheetRow[sHeader]).trim();
                }
            });
            return oFarmer;
        }).filter(function (oFarmer) {
            return oFarmer.FarmerNo || oFarmer.IdCard;
        });
    }

    return {
        /**
         * Press handler of the "Upload Farmer" table toolbar action.
         * Called with the List Report ExtensionAPI as "this".
         */
        onUploadPress: function () {
            const oExtensionAPI = this;
            const oBundle = oExtensionAPI.getModel("i18n").getResourceBundle();
            const oViewModel = new JSONModel({
                fileName: "",
                rowCount: 0,
                busy: false,
                hasResult: false,
                result: {}
            });
            let aFarmers = [];
            let oDialog;

            const oHandler = {
                onFileChange: async function (oEvent) {
                    const aFiles = oEvent.getParameter("files");
                    const oFile = aFiles && aFiles.length ? aFiles[0] : null;
                    aFarmers = [];
                    oViewModel.setProperty("/fileName", "");
                    oViewModel.setProperty("/rowCount", 0);
                    oViewModel.setProperty("/hasResult", false);
                    if (!oFile) {
                        return;
                    }

                    oViewModel.setProperty("/busy", true);
                    try {
                        aFarmers = await parseFarmerFile(oFile);
                        if (!aFarmers.length) {
                            MessageBox.warning(oBundle.getText("uploadFarmerNoRows"));
                            return;
                        }
                        oViewModel.setProperty("/fileName", oFile.name);
                        oViewModel.setProperty("/rowCount", aFarmers.length);
                    } catch (oError) {
                        MessageBox.error(oBundle.getText("uploadFarmerParseError", [oError.message || String(oError)]));
                    } finally {
                        oViewModel.setProperty("/busy", false);
                    }
                },

                formatSummary: function (iTotal, iSucceeded, iFailed) {
                    return oBundle.getText("uploadFarmerSummary", [iTotal, iSucceeded, iFailed]);
                },

                onTypeMissmatch: function () {
                    MessageToast.show(oBundle.getText("uploadFarmerInvalidType"));
                },

                onUpload: async function () {
                    if (!aFarmers.length) {
                        MessageToast.show(oBundle.getText("uploadFarmerNoFile"));
                        return;
                    }

                    oViewModel.setProperty("/busy", true);
                    try {
                        const oOperation = oExtensionAPI.getModel().bindContext("/Farmer/" + ACTION + "(...)");
                        oOperation.setParameter("payload", JSON.stringify(aFarmers));
                        await oOperation.invoke();

                        const oResult = oOperation.getBoundContext().getObject() || {};
                        oViewModel.setProperty("/result", oResult);
                        oViewModel.setProperty("/hasResult", true);
                        MessageToast.show(oBundle.getText("uploadFarmerDone", [oResult.succeeded, oResult.failed]));
                        oExtensionAPI.refresh();
                    } catch (oError) {
                        MessageBox.error(oError.message || String(oError));
                    } finally {
                        oViewModel.setProperty("/busy", false);
                    }
                },

                onClose: function () {
                    oDialog.close();
                },

                onAfterClose: function () {
                    oDialog.destroy();
                }
            };

            oExtensionAPI.loadFragment({
                id: "uploadFarmerDialog",
                name: FRAGMENT,
                controller: oHandler
            }).then(function (oLoadedDialog) {
                oDialog = oLoadedDialog;
                oDialog.setModel(oViewModel, "upload");
                oDialog.open();
            });
        }
    };
});
