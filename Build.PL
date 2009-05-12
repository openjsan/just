use Module::Build::JSAN;

my $build = Module::Build::JSAN->new(
    module_name    => 'JSAN',
    license        => 'artistic',
    dist_author    => 'John Cappiello <jcap@openjsan.org>',
    abstract       => 'JavaScript Archive Network',
    create_readme       => 1,
    build_requires => {
        'Test.Simple' => '0.11',
    },
    tags           => [qw[jsan use import libraries]],
);

$build->create_build_script;
