
/**
 * Load stored game controller
 */
const loadGameController = {

    /**
     * The load game page
     */
    index() {
        template.setNavTitle(translations.text("kaiChronicles"), "#mainMenu", true);
        template.showStatistics(false);
        views.loadView("loadGame.html").then(() => {

            if (!cordovaApp.isRunningApp()) {
                // Web page environment:
                loadGameView.hideFilesList();
                loadGameView.bindFileUploaderEvents();
            } else {
                // Cordova app files list
                loadGameView.hideFileUpload();
                loadGameView.bindAppEvents();
                loadGameController.listGameFiles();
            }

        });
    },

    /**
     * Called when the selected file changes (only web)
     * @param fileToUpload The selected file
     */
    fileUploaderChanged(fileToUpload: Blob) {
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                loadGameController.loadGame((e.target as any).result);
            };
            reader.readAsText(fileToUpload);
        } catch (e) {
            console.log(e);
            loadGameView.showError(e.toString());
        }
    },

    /**
     * Called when a file is selected (Android only)
     */
    fileListClicked(fileName: string) {
        cordovaFS.readRootTextFileAsync(fileName)
            .then(
                (fileContent: string) => {
                    loadGameController.loadGame(fileContent);
                },
                (error: any) => {
                    let msg = "Error loading saved game";
                    if (error) {
                        msg += ": " + error.toString();
                    }
                    alert(msg);
                },
            );
    },

    /**
     * Delete a saved game (Android only)
     * @param fileName The file name to delete
     */
    deleteFile(fileName: string) {

        cordovaFS.requestFileSystemAsync()
            .then((fs: any /* : FileSystem */) => {
                return cordovaFS.getFileAsync(fs.root, fileName);
            })
            .then((fileEntry /* : FileEntry */) => {
                return cordovaFS.deleteFileAsync(fileEntry);
            })
            .done(() => {
                toastr.success(translations.text("fileDeleted", [fileName]));
                loadGameView.removeFilenameFromList(fileName);
            })
            .fail((error) => {
                let msg = "Error deleting file";
                if (error) {
                    msg += ": " + error.toString();
                }
                alert(msg);
            });
    },

    /**
     * Export saved games to Downloads file (Android only)
     */
    exportSavedGames() {
        try {

            if (!confirm(translations.text("confirmExport"))) {
                return;
            }

            new SavedGamesExport().export()
                .then(
                    () => {
                        // OK
                        toastr.success(translations.text("exportedDownloads"));
                    },
                    (error) => {
                        // ERROR
                        let msg = translations.text("errorExporting");
                        if (error) {
                            msg += ": " + error.toString();
                        }
                        alert(msg);
                    },
                );
        } catch (e) {
            console.log(e);
            alert(translations.text("errorExporting") + ": " + e.toString());
        }
    },

    /**
     * Import saved games from a zip file
     */
    importSavedGames() {
        try {

            alert(translations.text("infoImport"));

            const importProcess = new SavedGamesExport();
            DocumentSelection.selectDocument()
                .then((doc: DocumentSelection) => {
                    return importProcess.import(doc);
                })
                .then(
                    () => {
                        // OK
                        toastr.success(translations.text("importedGames", [importProcess.nImportedGames]));
                        // Refresh games list
                        loadGameController.listGameFiles();
                    },
                    (error: any) => {
                        // ERROR
                        let msg = "Error importing saved games";
                        if (error) {
                            msg += ": " + error.toString();
                        }
                        alert(msg);
                    },
                );
        } catch (e) {
            console.log(e);
            alert("Error importing: " + e.toString());
        }
    },

    /** Return page */
    getBackController() { return "mainMenu"; },

    /**
     * Get a set a of file system entries, and return the names of those that are files
     * @param entries {Array<Entry>} Filesystem entries to check
     * @returns The file names
     */
    getFileNames(entries: any[]): string[] {

        // Get file names (entries is Array<Entry>)
        const fileNames: string[] = [];
        for (const entry of entries) {
            // There can be directories here (ex. downloaded books)
            if (entry.isFile) {
                fileNames.push(entry.name);
            }
        }

        return fileNames;
    },

    /**
     * Fill the Cordova app saved games list
     */
    listGameFiles() {
        loadGameView.clearFilesList();

        // Get files on the root directory of the persistent storage
        cordovaFS.requestFileSystemAsync()
            .then((fileSystem /* : FileSystem */) => {
                return cordovaFS.getRootFilesAsync(fileSystem);
            })
            .then((entries: any[]) => {

                // Get file names (entries is Array<Entry>)
                const fileNames = loadGameController.getFileNames(entries);

                // The list may be unsorted:
                fileNames.sort();
                loadGameView.addFilesToList(fileNames);
                loadGameView.bindListEvents();
            })
            .fail((error: any) => {
                // TODO: Test this
                let msg = "Error retrieving saved games list";
                if (error) {
                    msg += ": " + error.toString();
                }
                alert(error);
            });
    },

    /**
     * Load saved game and start to play it
     * @param jsonState The saved game file content
     */
    loadGame(jsonState: string) {
        try {
            state.loadSaveGameJson(jsonState);
            routing.redirect("setup");
        } catch (e) {
            console.log(e);
            if (cordovaApp.isRunningApp()) {
                alert(e.toString());
            } else {
                loadGameView.showError(e.toString());
            }
        }
    },

};
