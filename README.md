# Clone Spotter

A command line tool (made with NODEJS) to find duplicate files within your system based on file content.

The duplicates found are based on the _contents of the file_, **not** _the name of the files_.

It **outputs a json file** with an object that contains the paths of the duplicate files as well as the path to the first found occurance of the file.

Run the index.js file by either **npm run start** or by making an alias within your rc file of your shell and running that alias command.

For example, in my .zshrc file, I have the following line:

```alias findDups="cd ~/Documents/code/findDuplicates; node index.js; cd -"```

The alias will allow you to run this command in any directory.

You can enter the root directory by starting with "~" like so "~/Documents" if you're using a linux or unix based machine.

You also can just enter the name of the output file without the .json extension.

It asks three major questions:

1) Enter the directory to start search at: ```~/Desktop```
2) Enter the output file path: ```~/Desktop```
3) Enter name of file: ```duplicates```
4) Output to terminal as well? [y/n]: ```y```
