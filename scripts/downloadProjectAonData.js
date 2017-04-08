
const fs = require('node-fs-extra');
const projectAon = require( '../src/www/js/model/projectAon.js' ).projectAon;
const child_process = require('child_process');

/**
 * Tool to download book data from the Project Aon SVN
 * @param {Number} bookNumber The book number (1-based index)
 */
function BookData( bookNumber ) {

    this.bookNumber = bookNumber;

    var bookMetadata = projectAon.supportedBooks[ i - 1 ];
    /** The english book code */
    this.enCode = bookMetadata.code_en;
    /** The spanish book code */
    this.esCode = bookMetadata.code_es;
    /** Array with illustrations authors directories names */
    this.illAuthors = bookMetadata.illustrators;
}

/**
 * The SVN root
 */
BookData.SVN_ROOT = 'https://www.projectaon.org/data/tags/20151013';

/**
 * The target directory root
 */
BookData.TARGET_ROOT = 'src/www/data/projectAon';


/**
 * Get the book code for a given language
 */
BookData.prototype.getBookCode = function(language) {
    return language == 'en' ? this.enCode : this.esCode;
}

/**
 * Get the local relative path for the book data
 */
BookData.prototype.getBookDir = function() {
    return BookData.TARGET_ROOT + '/' + this.bookNumber;
}

/**
 * Download the book xml for a given language
 */
BookData.prototype.downloadXml = function(language) {
    var xmlFileName = this.getBookCode( language ) + '.xml';
    var sourcePath = BookData.SVN_ROOT + '/' + language + '/xml/' + 
        xmlFileName;
    var targetPath = this.getBookDir() + '/' + xmlFileName;
    var svnParams = [ 'export' , sourcePath , targetPath ];
    BookData.runSvnCommand( svnParams );
}

/**
 * Get the svn absolute URL for illustrations directory of a given author / language
 */
BookData.prototype.getSvnIllustrationsDir = function( language, author) {
    var booksSet = language == 'en' ? 'lw' : 'ls';
    return BookData.SVN_ROOT + '/' + language + '/png/' + 
        booksSet + '/' + this.getBookCode(language) + '/ill/' + 
        author;
}

/**
 * Download illustrations
 */
BookData.prototype.downloadIllustrations = function(language, author) {
    var sourceSvnDir = this.getSvnIllustrationsDir(language, author);
    var targetDir = this.getBookDir() + '/ill_' + language;
    fs.mkdirSync( targetDir );
    var svnParams = [ '--force', 'export' , sourceSvnDir , targetDir ];
    BookData.runSvnCommand( svnParams );
}

/**
 * Download the book cover
 */
BookData.prototype.downloadCover = function() {

    var coverPath = BookData.SVN_ROOT + '/en/jpeg/lw/' + this.getBookCode('en') +
        '/skins/ebook/cover.jpg';
    var targetPath = this.getBookDir() + '/cover.jpg';
    var svnParams = [ 'export' , coverPath , targetPath ];
    BookData.runSvnCommand( svnParams );
}

BookData.prototype.downloadBookData = function() {
    fs.mkdirSync( BookData.TARGET_ROOT + '/' + this.bookNumber );
    this.downloadCover();
    this.downloadXml('en');
    this.downloadXml('es');
    this.illAuthors.forEach( (author) => {
        this.downloadIllustrations('en' , author);
        this.downloadIllustrations('es' , author);
    });
    this.downloadCombatTablesImages('en');
    this.downloadCombatTablesImages('es');
}

BookData.prototype.downloadCombatTablesImages = function(language) {
    var sourceSvnDir = this.getSvnIllustrationsDir(language, 'blake');
    var targetDir = this.getBookDir() + '/ill_' + language;
    BookData.runSvnCommand( [ 'export' , sourceSvnDir + '/crtneg.png' , 
        targetDir + '/crtneg.png' ] );
    BookData.runSvnCommand( [ 'export' , sourceSvnDir + '/crtpos.png' , 
        targetDir + '/crtpos.png' ] );
}

BookData.runSvnCommand = function( params ) {
    console.log( 'svn ' + params.join( ' ' ) );
    child_process.execFileSync( 'svn' , params , {stdio:[0,1,2]} );
}

// Recreate the directory
fs.removeSync( BookData.TARGET_ROOT );
fs.mkdirSync( BookData.TARGET_ROOT );

// Download books data
for( var i=1; i <= projectAon.supportedBooks.length; i++ )
    new BookData(i).downloadBookData();

