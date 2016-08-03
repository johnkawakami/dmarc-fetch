# dmarc-fetch

This is a command that downloads DMARC reports from an email
account, unzips them, and inserts some data into a MySQL database.

It's factored out so it's not too hard to code objects to fetch different
kinds of mail, and store into other databases.

## ToDo

The xml attachment extraction strategies are determined
by the sender's domain. This has to be made more
generic. So far there are two ways to send the attachment:

* File in the body
* File as first attachment

And there are two compressions:

* Zip file with similarly named XML file inside
* Gzip compressed XML file

## Troubleshooting

Note that with IMAP servers, the hierarchy deliminter (the
directory separator) is not always ".". The server can use
almost any character, and ".", "/", and "\" are the more common
characters.

## Tip

I did this little utility to learn to write commands in node.
I would not use node for something like this in the future.
Managing async is more work, and for this program, doesn't
have any benefits.

