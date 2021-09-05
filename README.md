# Prettier plugin that supports mixed PHP and short tags

This is mostly a workaround for the limitations put upon by @prettier/plugin-php, like not supporting `<?` or a trailing `?>` and not dealing well with HTML and PHP mixed together.

This pluign works around them in various ways, like replacing `<?` for `<?php` proper, and first formatting the PHP code and then formatting it as HTML code.

It seems to work in my tests so far, but it is undertested, so unconsidered edge cases are very likely to occur.

_WARNING_: By leveraging the existing HTML and PHP plugins, we need to add them and prettier to the dependencies, which can lead to unexpected results if the code is formatted using a different version of prettier.
