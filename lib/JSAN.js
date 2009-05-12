/*

=head1 NAME

JSAN - JavaScript Archive Network

=head1 SYNOPSIS

  <script type="text/javascript" src="/js/JSAN.js"></script>
  <script>
      JSAN.use('Test.Simple');
      plan({tests: 1});
      ok(1 == 1, 'one does equal one!');
  </script>

  // Or in a library.
  if (typeof JSAN != 'undefined') {
      JSAN.use('Some.Library');
  }

=head1 DESCRIPTION

This library allows JavaScript to behave more like traditional programming
languages and offers the programmer the abilility to create well-designed,
modular code.

=cut

*/

var JSAN = function () { JSAN.addRepository(arguments) }

JSAN.VERSION = 0.10;

/*

=head2 Class Properties

=head3 globalScope

  JSAN.globalScope = _player;

By default C<globalScope> is set to the value of C<self>. This works
great in web browswers, however other environments may not have C<self>
(an alias for C<window> in web browswers) for a global context. In those
cases, such as embedded JavaScript, you should reset C<globalScope>
before calling C<use()>.

=head3 includePath

  JSAN.includePath = [];

The C<includePath> is a list of URLs that should be used as prefixes
for libraries when they are C<use()>d. If you are adding repositories
please consider using the C<addRepository()> method.

=head3 errorLevel

  JSAN.errorLevel = "die";

By default the C<errorLevel> is set to I<none>. This will supress errors
when trying to load libraries.

I<die> will throw an exception and it is the responsibility of the calling
code to catch it.

I<warn> will use the C<alarm()> function, usually present in web browsers,
to alert a user on error. This is good for debugging (in web browsers).

=head3 errorMessage

  var error = JSAN.errorMessage;

This contains the text of any error, no matter what the C<errorLevel>. Inspect
it to discover problems.

=head3 loaded

  JSAN.loaded["Foo/Bar.js"] = Foo.Bar;

This object lists path to class definition mappings. The object is populated
with members by C<JSAN.require()>. The class definition is the one found
when evaluating the package name during namespace creation. It is the
same class definition that C<JSAN.require()> and C<JSAN.use()> returns.

=cut

*/

JSAN.globalScope   = self;
JSAN.includePath   = ['.', 'lib'];
JSAN.errorLevel    = "none";
JSAN.errorMessage  = "";
JSAN.loaded        = {};

/*

=head2 Class Methods

=head3 JSAN.use()

    JSAN.use('Test.Simple');
    JSAN.use('DOM.Display');

Download and import a library. There is a mapping that is done with the
library name: it must be converted into a URL. Here is how it works.

  Test.Simple        Test/Simple.js
  HTTP.Request       HTTP/Request.js
  Foo.Bar.Baz        Foo/Bar/Baz.js

Each C<includePath> is then prepended, and the file requested, until it is
found.  The first working path in C<includePath> is used.

The library's constructor and prototype are imported into the calling
context. You can also request certain functions, or groups of functions,
to be imported explicitly. These groups can be done either singly or in
an array, whichever is more convenient. You can also explicitly choose to import nothing.
Here is an example of each.

  // Explicitly choose certain functions
  JSAN.use('Test.More', 'plan', 'ok', 'is');
  
  // Explicitly choose a certain tag
  JSAN.use('Digest.MD5', ':all');

  // Explicitly choose nothing
  JSAN.use('Digest.MD5', []);

  // Be really weird
  var stuff = [ 'h', 'i', ['j'] ];
  stuff.push( 'abc' );
  JSAN.use('Some.Module', 'a', 'b', [ 'c', 'd' ], stuff, 'f' );

=cut

*/

JSAN.use = function () {
    var classdef = JSAN.require(arguments[0]);
    if (!classdef) return null;

    var importList = JSAN._parseUseArgs.apply(JSAN, arguments).importList;
    JSAN.exporter(classdef, importList);

    return classdef;
}

/*

=head3 JSAN.require()

  JSAN.require('Some.Class');

Loads a class into your scope. This will not export any symbols.

=cut

*/

JSAN.require = function (pkg) {
    var path = JSAN._convertPackageToPath(pkg);
    if (JSAN.loaded[path]) {
        return JSAN.loaded[path];
    }

    try {
        var classdef = eval(pkg);
        if (typeof classdef != 'undefined') return classdef;
    } catch (e) { /* nice try, eh? */ }


    for (var i = 0; i < JSAN.includePath.length; i++) {
        var js;
        try{
            var url = JSAN._convertPathToUrl(path, JSAN.includePath[i]);
                js  = JSAN._loadJSFromUrl(url);
        } catch (e) {
            if (i == JSAN.includePath.length - 1) throw e;
        }
        if (js != null) {
            var classdef = JSAN._createScript(js, pkg);
            JSAN.loaded[path] = classdef;
            return classdef;
        }
    }
    return false;

}

/*

=head3 JSAN.exporter()

  JSAN.exporter(Test.More, 'plan', 'is', 'cmpOk');

Export symbols from the class defined in the first argument to the global
scope. Note that the first argument to C<JSAN.exporter()> is B<not>
a string, but the actual class definition. The example above will
export the functions C<plan>, C<is>, and C<cmpOk> from the C<Test.More>
namespace to yours.

=cut

*/

JSAN.exporter = function () {
    JSAN._exportItems.apply(JSAN, arguments);
}

/*

=head3 JSAN.addRepository()

  JSAN.addRepository('js/private');

Add any number of paths to C<includePath>. This will move the repository to the
beginning of the list and it will be checked first for libraries. Calling
C<addRepository()> will add your include path for the entirety of the
request, no matter how many times you call C<JSAN.use()>.

As with use(), it will accept any combination of arrays and strings.

=cut

*/

JSAN.addRepository = function () {
    var temp = JSAN._flatten( arguments );
    // Need to go in reverse to do something as simple as unshift( @foo, @_ );
    for ( var i = temp.length - 1; i >= 0; i-- )
        JSAN.includePath.unshift(temp[i]);
    return JSAN;
}

JSAN._flatten = function( list1 ) {
    var list2 = new Array();
    for ( var i = 0; i < list1.length; i++ ) {
        if ( typeof list1[i] == 'object' ) {
            list2 = JSAN._flatten( list1[i], list2 );
        }
        else {
            list2.push( list1[i] );
        }
    }
    return list2;
};

JSAN._findMyPath = function () {
    if (document) {
        var scripts = document.getElementsByTagName('script');
        for ( var i = 0; i < scripts.length; i++ ) {
            var src = scripts[i].getAttribute('src');
            if (src) {
                var inc = src.match(/^(.*?)\/?JSAN.js/);
                if (inc && inc[1]) {
                    var repo = inc[1];
                    for (var j = 0; j < JSAN.includePath.length; j++) {
                        if (JSAN.includePath[j] == repo) {
                            return;
                        }
                    }
                    JSAN.addRepository(repo);
                }
            }
        }
    }
}
JSAN._findMyPath();

JSAN._convertPathToUrl = function (path, repository) {
    return repository.concat('/' + path);
};
    

JSAN._convertPackageToPath = function (pkg) {
    var path = pkg.replace(/\./g, '/');
        path = path.concat('.js');
    return path;
}

JSAN._parseUseArgs = function () {
    var pkg        = arguments[0];
    var importList = [];

    for (var i = 1; i < arguments.length; i++)
        importList.push(arguments[i]);

    return {
        pkg:        pkg,
        importList: importList
    }
}

JSAN._loadJSFromUrl = function (url) {
    return new JSAN.Request().getText(url);
}

JSAN._findExportInList = function (list, request) {
    if (list == null) return false;
    for (var i = 0; i < list.length; i++)
        if (list[i] == request)
            return true;
    return false;
}

JSAN._findExportInTag = function (tags, request) {
    if (tags == null) return [];
    for (var i in tags)
        if (i == request)
            return tags[i];
    return [];
}

JSAN._exportItems = function (classdef, importList) {
    var exportList  = new Array();
    var EXPORT      = classdef.EXPORT;
    var EXPORT_OK   = classdef.EXPORT_OK;
    var EXPORT_TAGS = classdef.EXPORT_TAGS;
    
    if (importList.length > 0) {
       importList = JSAN._flatten( importList );

       for (var i = 0; i < importList.length; i++) {
            var request = importList[i];
            if (   JSAN._findExportInList(EXPORT,    request)
                || JSAN._findExportInList(EXPORT_OK, request)) {
                exportList.push(request);
                continue;
            }
            var list = JSAN._findExportInTag(EXPORT_TAGS, request);
            for (var i = 0; i < list.length; i++) {
                exportList.push(list[i]);
            }
        }
    } else {
        exportList = EXPORT;
    }
    JSAN._exportList(classdef, exportList);
}

JSAN._exportList = function (classdef, exportList) {
    if (typeof(exportList) != 'object') return null;
    for (var i = 0; i < exportList.length; i++) {
        var name = exportList[i];

        if (JSAN.globalScope[name] == null)
            JSAN.globalScope[name] = classdef[name];
    }
}

JSAN._makeNamespace = function(js, pkg) {
    var spaces = pkg.split('.');
    var parent = JSAN.globalScope;
    eval(js);
    var classdef = eval(pkg);
    for (var i = 0; i < spaces.length; i++) {
        var name = spaces[i];
        if (i == spaces.length - 1) {
            if (typeof parent[name] == 'undefined') {
                parent[name] = classdef;
                if ( typeof classdef['prototype'] != 'undefined' ) {
                    parent[name].prototype = classdef.prototype;
                }
            }
        } else {
            if (parent[name] == undefined) {
                parent[name] = {};
            }
        }

        parent = parent[name];
    }
    return classdef;
}

JSAN._handleError = function (msg, level) {
    if (!level) level = JSAN.errorLevel;
    JSAN.errorMessage = msg;

    switch (level) {
        case "none":
            break;
        case "warn":
            alert(msg);
            break;
        case "die":
        default:
            throw new Error(msg);
            break;
    }
}

JSAN._createScript = function (js, pkg) {
    try {
        return JSAN._makeNamespace(js, pkg);
    } catch (e) {
        JSAN._handleError("Could not create namespace[" + pkg + "]: " + e);
    }
    return null;
}


JSAN.prototype = {
    use: function () { JSAN.use.apply(JSAN, arguments) }
};


// Low-Level HTTP Request
JSAN.Request = function (jsan) {
    if (JSAN.globalScope.XMLHttpRequest) {
        this._req = new XMLHttpRequest();
    } else {
        this._req = new ActiveXObject("Microsoft.XMLHTTP");
    }
}

JSAN.Request.prototype = {
    _req:  null,
    
    getText: function (url) {
        this._req.open("GET", url, false);
        try {
            this._req.send(null);
            var stat = this._req.status;
            //           OK   Not Modified    IE Cached   Safari cached
            if (stat == 200 || stat == 304 || stat == 0 || stat == null) {
                var r = this._req.responseText;
                this._req = null;
                return r;
            }

        } catch (e) {
            JSAN._handleError("File not found: " + url);
            return null;
        };

        JSAN._handleError("File not found: " + url);
        return null;
    }
};

/*

=head2 Compile Time

C<JSAN> creates an interesting sort of compile time for libraries loaded
through it. This means that code that does not exist inside of a function
is considered I<compile time> code. This has certain implications when
a library uses JSAN to import another library.

=head2 Namespaces

JavaScript - exempting version 2 anyway - does not have a notion of
namespaces. For this reason something very important has been missing.
However, JavaScript's object system is perfectly suited to create
namespaces for well written code.

The first thing you have to do when creating a library is define the
namespace. The namespace must match the library name as well so C<use()>
can import the classes and functions correctly.

The name of this library, C<JSAN>, or the name of our testing system,
C<Test.Simple>, are examples of namespaces. A namespace is built by
defining objects at each level until you reach the final name.

Defining a namespace for JSAN is simple.

  var JSAN = {};

Defining the namespace for C<Test.Simple> takes a little more work.
First you have to create an object at the variable named C<Test> if
it doesn't already exist. Then you can create an object, or place a
constructor, at the C<Test.Simple> location.

  if (typeof Test == 'undefined') Test = {};
  Test.Simple = {};

So far we've just been inserting blank objects at the final namespace.
That's fine if your library implements functions and does not
implement a class. However, if you implement a class you will want
to place a constructor in the final namespace instead.

  if (typeof Name == 'undefined') Name = {};
  
  Name.Space = function () {
      // This is the constructor.
  }

Further, you'll want to define your class. This is done by defining
the prototype in your namespace.

  Name.Space.prototype = {
      publicProperty: 'you see me',
      
      _privateProperty: 'boo',
      
      publicMethod: function (arg1, arg2) {
          // We do stuff man.
      },
      
      _privateMethod: function () {
          this._privateProperty = "no peaking";
      }
  };

=head2 Exporting

The C<use()> function supports an Exporter style system. This means that
you can create functions that will be exported to the caller
automatically, functions that will be exported when requested, and
groups of functions - called tags - that are exported when requested.

=head3 EXPORT

Set up functions that are auto-exported B<unless> the caller declares a
function list.

  Name.Space.EXPORT = [ 'functionOne', 'functionTwo' ];

Importing the default functions.

  jsan.use('Name.Space');

Importing specific functions.

  jsan.use('Name.Space', 'functionOne'); // Don't want functionTwo()

=head3 EXPORT_OK

Set up functions that are exported only by request.

  Name.Space.EXPORT    = [ 'functionOne', 'functionTwo' ];
  Name.Space.EXPORT_OK = [ 'specialOne',  'specialTwo'  ];

Import the default functions. This will B<not> import any functions inside
the C<EXPORT_OK> list.

  jsan.use('Name.Space');

Import some specific function from C<EXPORT_OK>. This will B<not> import any
functions from the C<EXPORT> list.

  jsan.use('Name.Space', 'specialOne');

=head3 EXPORT_TAGS

Set up a grouping of functions that can be exported all at once. This example
also illustrates something I dislike about JavaScript arrays. I'll leave that
for you to discover.

  function _expandTheFreakingLists () {
      var expanded = [];
      for (var i = 0; i <= arguments.length; i++ ) {
          var list = arguments[i];
          for (var j = 0; j <= list.length; j++) {
              expanded.push(list[j]);
          }
      }
      return expanded;
  }

  Name.Space.EXPORT_TAGS = {
      ":common": Name.Space.EXPORT,
      ":all":    _expandTheFreakingLists(Name.Space.EXPORT, Name.Space.EXPORT_OK)
  };

Now import all the functions.

  jsan.use('Name.Space', ':all');

Import the common functions and one special one.

  jsan.use('Name.Space', ':common', 'specialOne');

=head2 Writing Libraries

=head3 Class Libraries

Class libraries implement a public class that will be exported to the caller.
The public class contains the same name as the package C<use()> was called
with.

First, you have to set up a namespace.

  if (typeof DOM == 'undefined') DOM = {};

  DOM.Display = function () {};

Next you can define the class's prototype.

  DOM.Display.prototype = {
      register: {},
  
      hideElement: function (id) {
          // Do stuff.
      },
  
      showElement: function (id) {
          // Do stuff.
      },
  
      showOnlyElement: function (id) {
          // Do stuff.
      },
  
      registerElement: function (id) {
          // Do stuff.
      }
  };


At this point your library may have dependencies. If that's the case you
can use C<JSAN> to try and import them. This works because you have,
theoretically, modified the C<JSAN.includePath> on your initial
invocation of the library. So your libraries being C<use()>d need not
know anything about C<includePath>s.

  if (typeof JSAN != 'undefined') {
      JSAN.use('Some.Dependency');
  }

=head3 Functional Libraries

Functional libraries strictly intend to export a set of functions to the
caller. While they may contain a class, or many classes, those classes are
not part of the publicly documented API. These are simple to create but a
few rules do apply.

First, you still have to set up a namespace.

  if (typeof Digest == 'undefined') Digest = {};
  Digest.MD5 = {};

Next you can define your export list.

  Digest.MD5.EXPORT_OK   = [  'md5', 'md5Hex', 'md5Base64' ];
  Digest.MD5.EXPORT_TAGS = { ':all': Digest.MD5.EXPORT_OK };

Now you may go on to define your functions. They must be fully qualified
just like the C<EXPORT_OK> and C<EXPORT_TAGS> variables.

  Digest.MD5.md5 = function (str) {
      // Do stuff.
  }

  Digest.MD5.md5Hex = function (str) {
      // Do stuff.
  }

  Digest.MD5.md5Base64 = function (str) {
      // Do stuff.
  }

At this point your library may have dependencies. If that's the case you can
use C<JSAN> to try and import them.

  if (typeof JSAN != 'undefined') {
      JSAN.use('Some.Dependency');
  } else {
      if (Digest.MD5.DEBUG == true
          && typeof Some.Dependency == 'undefined') {
          throw new Error("Some.Dependency not loaded.");
      }
  }

=head1 SEE ALSO

JavaScript Namespaces,
L<http://justatheory.com/computers/programming/javascript/emulating_namespaces.html>.

Original JSAN Brainstorming,
L<http://use.perl.org/~schwern/journal/24112>.

OpenJSAN,
L<http://openjsan.org>.

Signed JavaScript,
L<http://www.mozilla.org/projects/security/components/jssec.html>.

=head1 AUTHOR

Current maintainer: John Cappiello <F<jcap@openjsan.org>>.
Original author: Casey West, <F<casey@geeknest.com>>.

=head1 COPYRIGHT

  Copyright (c) 2005 Casey West.  All rights reserved.
  This module is free software; you can redistribute it and/or modify it
  under the terms of the Artistic license.

=cut

*/
