# dmarc-fetch

This is a command that downloads DMARC reports from an email
account, unzips them, and inserts some data into a MySQL database.

It's factored out so it's not too hard to code objects to fetch different
kinds of mail, and store into other databases.

It's finished, but it's not polished.

## Troubleshooting

Note that with IMAP servers, the hierarchy deliminter (the
directory separator) is not always ".". The server can use
almost any character, and ".", "/", and "\" are the more common
characters.
