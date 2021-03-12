#!/bin/bash

set -e


mkdir $4
cd $4

rm -r -f target_folder
rm -r -f svn_source
rm -r -f git_source


git clone --branch $2 --single-branch $1 git_source
svn mkdir  --username $SVN_USERNAME --password $SVN_PASSWORD --parents -m 'creating branch'  $3 || true
svn checkout --username $SVN_USERNAME --password $SVN_PASSWORD  --non-interactive $3 svn_source
cd svn_source
previousHash=""
if [ -f syncHash.ddl ]
then
   previousHash=$(cat syncHash.ddl)
fi
cd ..

cd git_source
currentHash=$(git rev-parse HEAD)
changelog=$(git log --pretty=format:"%h%x09%an%x09%s" $previousHash...$currentHash)
#check if changelog is empty and changelog=$(git log -1 --pretty=format:"%h%x09%an%x09%s")
echo $changelog
echo "$currentHash" > syncHash.ddl
cd ..
echo $previousHash
echo $currentHash

mkdir target_folder
mkdir target_folder/.svn

cp -a svn_source/.svn/. target_folder/.svn/
cp -a git_source/. target_folder/
rm -r target_folder/.git

rm -r svn_source
rm -r git_source

cd target_folder
if [[ ! -z $(svn status) ]]; then
    echo "there are files"
    
    delparams=$(svn st | grep ^! | cut -b9- | sed 's/^/"/;s/$/"/')
        echo $delparams
        if [[ ! -z "${delparams// }" ]]; then
            svn st | grep ^! | cut -b9- | sed 's/^/"/;s/$/"/' | xargs svn delete
        fi
    svn add --force .
    echo "$changelog" > changelog.txt
    svn commit --username $SVN_USERNAME --password $SVN_PASSWORD  --non-interactive  --file changelog.txt
    rm changelog.txt    
else
    echo "no files found"
fi

if [[ $(svn status) ]]; then
    echo "Error still files!" 1>&2
    exit 64
else
    svn update --username $SVN_USERNAME --password $SVN_PASSWORD  --non-interactive
    svn info |grep Revision: |cut -c11- > svnRevision.txt
    echo "suceeded"
fi
cd ..
