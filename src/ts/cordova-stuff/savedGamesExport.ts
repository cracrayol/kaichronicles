
/**
 * Handles export / import saved games
 */
class SavedGamesExport {

    /**
     * Check file entries, get those that are saved games
     * @param {Array<Entry>} entries File entries to check
     * @returns {Array<Entry>} The saved games
     */
    private static filterSavedGamesEntries(entries: any[]): any[] {
        const result = [];
        for (const entry of entries) {
            let ok = true;
            if (!entry.isFile) {
                ok = false;
            }
            if (cordovaFS.getFileNameAndExtension(entry.name).extension.toLowerCase() !== "json") {
                ok = false;
            }
            if (ok) {
                result.push(entry);
            }
        }
        return result;
    }

    /** Number of imported games */
    public nImportedGames = 0;

    /**
     * The Cordova persistent file system (FileSystem)
     */
    private fs: any = null;

    /**
     * Saved games file entries (Array<Entry>)
     */
    private fileGameEntries: any[] = null;

    /**
     * Temporal directory (DirectoryEntry)
     */
    private tmpDir: any = null;

    /**
     * Files to delete after the process end
     */
    private filesToDeleteAtEnd: any[] = [];

    /**
     * Export saved games to Download directory
     * @returns Promise with the export process
     */
    public export(): JQueryPromise<void> {
        const self = this;
        let zipPath: string = null;
        const zipFileName = "KaiChroniclesExport-" + settingsController.getDateForFileNames() + ".zip";

        const process = this.setup()
            .then(() => {
                // Return a human readable error if there are no files to export:
                if (self.fileGameEntries.length === 0) {
                    return jQuery.Deferred().reject(translations.text("noGamesToExport")).promise();
                } else {
                    return jQuery.Deferred().resolve().promise();
                }
            })
            .then(() => {
                console.log("Copying file games to tmp dir (" + self.fileGameEntries.length + ")");
                return cordovaFS.copySetToAsync(self.fileGameEntries, self.tmpDir);
            })
            .then(() => {
                // Create the zip. If it's created on the tmp directory, the zip creation will fail
                console.log("Creating zip file on root directory");
                zipPath = self.fs.root.toURL() + zipFileName;
                return cordovaFS.zipAsync(self.tmpDir.toURL(), zipPath);
            })
            .then(() => {
                console.log("Get the zip file entry");
                return cordovaFS.getFileAsync(self.fs.root, zipFileName);
            })
            .then((entry: any) => {
                // This generated zip file will be removed at the end of the process
                self.filesToDeleteAtEnd.push(entry);

                console.log("Copying the zip to Download directory");
                // Copy the zip
                return cordovaFS.copyToDownloadAsync(zipPath, zipFileName, "Kai Chronicles saved games export", "application/zip");
            });

        // Cleant tmp files
        return this.clean(process);

    }

    /**
     * Import saved games from a file
     * @param doc File with the games to import
     * @returns Promise with the export process. Parameter is the number of imported games
     */
    public import(doc: DocumentSelection): JQueryPromise<number> {
        const self = this;

        const process = this.setup()
            .then(() => {
                // Get the file type. It can be a zip file or a json file
                // TODO: Check the mime type too?
                const nameAndExtension = cordovaFS.getFileNameAndExtension(doc.fileName.toLowerCase());
                if (nameAndExtension.extension === "zip") {
                    return self.importZip(doc);
                } else if (nameAndExtension.extension === "json") {
                    return self.importJson(doc);
                } else {
                    // Wrong extension
                    return jQuery.Deferred().reject(translations.text("importExtensionsError")).promise();
                }
            });

        // Cleant tmp files
        return this.clean(process);
    }

    /**
     * Import saved games from a zip file
     * @param doc File with the games to import
     * @returns Promise with the import process. Parameter is the number of imported games
     */
    private importZip(doc: DocumentSelection): JQueryPromise<number> {

        const self = this;
        let nNewGames = 0;
        const zipContent: any = null;
        let entriesToImport: any[] = null;

        return this.copyFileContent(doc, this.tmpDir)
            .then((zipFileEntryOnTmpDir /* : FileEntry */) => {
                console.log("Unziping file on tmp directory");
                return cordovaFS.unzipAsync(zipFileEntryOnTmpDir.toURL(), self.tmpDir.toURL());
            })
            .then(() => {
                console.log("Get unziped files");
                return cordovaFS.readEntriesAsync(self.tmpDir);
            })
            .then((entries: any[]) => {
                console.log("Filtering unziped files");
                entriesToImport = SavedGamesExport.filterSavedGamesEntries(entries);

                // Check if some file will be overwritten
                const newFileNames: string[] = [];
                for (const entry of entriesToImport) {
                    newFileNames.push(entry.name);
                }

                return self.checkOverwritting(newFileNames);
            })
            .then(() => {
                console.log("Copying saved games to the root");
                nNewGames = entriesToImport.length;
                return cordovaFS.copySetToAsync(entriesToImport, self.fs.root);
            })
            .then(() => {
                // Notify the number of imported games
                self.nImportedGames = nNewGames;
                return jQuery.Deferred<number>().resolve(nNewGames).promise();
            });
    }

    /**
     * Import a saved game file
     * @param doc File with the saved game to import
     * @returns Promise with the import process. Parameter is the number of imported games
     */
    private importJson(doc: DocumentSelection): JQueryPromise<number> {
        const self = this;

        return self.checkOverwritting([doc.fileName])
            .then(() => {
                // Create the json file
                return self.copyFileContent(doc, self.fs.root);
            })
            .then(() => {
                // Notify the number of imported games
                self.nImportedGames = 1;
                return jQuery.Deferred<number>().resolve(1).promise();
            });
    }

    /**
     * Check if some file will be overwritten on import
     * @param newFiles File names to import
     * @returns Promise with the user confirmation to continue the process
     */
    private checkOverwritting(newFiles: string[]): JQueryPromise<void> {

        const duplicatedFiles: string[] = [];
        for (const newFile of newFiles) {
            for (const oldFile of this.fileGameEntries) {
                // Case sensitive
                if (oldFile.name === newFile) {
                    duplicatedFiles.push(newFile);
                }
            }
        }

        const dfd = jQuery.Deferred<void>();
        if (duplicatedFiles.length === 0) {
            // Ok, there will be no duplicates
            dfd.resolve();
        } else {
            const msg = translations.text("confirmSavedOverwrite", [duplicatedFiles.join("\n")]);
            if (confirm(msg)) {
                dfd.resolve();
            } else {
                dfd.reject("Import cancelled");
            }
        }

        return dfd.promise();
    }

    /**
     * Copy a file content to other directory
     * @param doc The file to copy
     * @param {DirectoryEntry} parent Directory where to create the new file
     */
    private copyFileContent(doc: DocumentSelection, parent: any): JQueryPromise<any> {

        let fileContent: any = null;

        // Well, the Entry returned by window.resolveLocalFileSystemURI( doc.uri ) is not really a FileEntry: It cannot be
        // copied with "copyTo". I suspect it's because is not a "file://" URL (it's a "content://").
        // So, get the file content, and create the the file on the tmp directory manually

        // Well, second part, oh... If you pick a file with the "File Explorer", you get a "file://" uri, and the readFileAsync does not work...
        // Who knows why. The error code is 1 (not found). Also, "copyToAsync" fails (or "resolveLocalFileSystemURIAsync") if sems to fail
        // with a URL outside the app content. So, I have created a external plugin function.
        if (doc.uri.toLowerCase().startsWith("file://")) {
            console.log("Copy zip to the tmp directory");
            return cordovaFS.copyNativePathsAsync(doc.uri, parent.toURL());
        } else {
            return cordovaFS.resolveLocalFileSystemURIAsync(doc.uri)
                // THIS DOES NOT WORK FOR "content://" entries
                // .then( function( entry /* : Entry */ ) {
                //     console.log( 'Copy zip to the tmp directory' );
                //     return cordovaFS.copyToAsync( entry , self.tmpDir , doc.fileName )
                // })
                .then((entry /* : Entry */) => {
                    console.log("Reading file content");
                    return cordovaFS.readFileAsync(entry, true);
                })
                .then((content: any) => {
                    fileContent = content;
                    console.log("Creating empty file");
                    return cordovaFS.getFileAsync(parent, doc.fileName, { create: true, exclusive: false });
                })
                .then((newFileEntry /* : FileEntry */) => {
                    console.log("Save the file content");
                    return cordovaFS.writeFileContentAsync(newFileEntry, fileContent);
                });
        }
    }

    /**
     * Setup current instance members
     * @returns Promise with the members setup process
     */
    private setup(): JQueryPromise<void> {
        const self = this;

        // Retrieve a FS and the saved games
        return cordovaFS.requestFileSystemAsync()
            .then((fileSystem /* : FileSystem */) => {
                self.fs = fileSystem;
                // Get save game files
                console.log("Get save game files");
                return cordovaFS.getRootFilesAsync(fileSystem);
            })
            .then((entries: any[]) => {
                console.log("Storing saved games entries");
                // Store saved games, and ignore others. There can be directories here (ex. downloaded books)
                self.fileGameEntries = SavedGamesExport.filterSavedGamesEntries(entries);

                // Re-create the tmp directory
                return self.createTmpDirectory();
            })
            .then((tmpDirEntry) => {
                // Store the tmp directory entry
                self.tmpDir = tmpDirEntry;
            });
    }

    /**
     * Re-create the temporal directory
     * @returns The process
     */
    private createTmpDirectory(): JQueryPromise<void> {
        const self = this;

        const dirName = "tmpKaiChronicles";
        // Check if the directory exists
        return cordovaFS.getDirectoryAsync(this.fs.root, dirName, { create: false })
            .then(
                (dirEntry) => {
                    // Directory exists. Remove it
                    console.log("Deleting previous tmp directory");
                    return cordovaFS.deleteDirRecursivelyAsync(dirEntry);
                },
                (errorDirDontExists) => {
                    // Directory does not exists. Do nothing
                    return jQuery.Deferred().resolve().promise();
                },
            )
            .then(() => {
                // Create the directory
                console.log("Creating tmp directory");
                return cordovaFS.getDirectoryAsync(self.fs.root, dirName, { create: true });
            });
    }

    /**
     * Add execution to clean the generated tmp files
     * @param process The process to run
     * @returns The "process" parameter
     */
    private clean(process: JQueryPromise<any>): JQueryPromise<any> {
        const self = this;

        // This is horrifying. Any better way to do it???

        // Delete tmp files in any case (success or error)
        return process
            .then(
                // Ok. Clean
                self.cleanTmpFiles.bind(self),
                (error) => {
                    // Error happened. Clean and return the PREVIOUS error
                    return self.cleanTmpFiles()
                        .then(
                            () => jQuery.Deferred().reject(error).promise(),
                            () => jQuery.Deferred().reject(error).promise(),
                        );
                },
            );

    }

    /**
     * Delete the temporal directory and other generated tmp files
     * @returns The deletion process
     */
    private cleanTmpFiles(): JQueryPromise<void> {

        // Delete tmp directory
        let rootPromise;
        if (!this.tmpDir) {
            console.log("No tmp dir stored");
            // Nothing to do
            rootPromise = jQuery.Deferred().resolve().promise();
        } else {
            console.log("Deleting tmp directory");
            rootPromise = cordovaFS.deleteDirRecursivelyAsync(this.tmpDir);
        }

        // Delete other tmp files
        const self = this;
        return rootPromise
            .then(() => {
                console.log("Deleting other tmp files");

                const promises: Array<JQueryPromise<any>> = [];
                for (const tmpFile of self.filesToDeleteAtEnd) {
                    promises.push(cordovaFS.deleteFileAsync(tmpFile));
                }

                // Wait for all deletions to finish
                return $.when.apply($, promises);
            });
    }

}
